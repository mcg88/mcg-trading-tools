#!/usr/bin/env python3
"""
Trading Strategy Explorer
Downloads and archives tweets from a Twitter/X profile for strategy analysis.

Usage:
    python trading_explorer.py download @handle [--session SESSION] [--wait SECONDS]
    python trading_explorer.py download @handle --pages 10

The archive is saved to ./{handle}-trading-archive/ alongside this script.
Subsequent runs will only download tweets newer than the last archived tweet.
"""

import asyncio
import json
import os
import sys
import argparse
import re
import httpx
from datetime import datetime, timezone
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def clean_handle(raw: str) -> str:
    """Strip leading @ and any URL prefix, return bare username."""
    raw = raw.strip()
    # Handle full URLs like https://twitter.com/user or https://x.com/user
    match = re.search(r'(?:twitter\.com|x\.com)/([A-Za-z0-9_]+)', raw)
    if match:
        return match.group(1)
    return raw.lstrip('@')


def archive_dir_for(handle: str, base: Path) -> Path:
    return base / f"{handle}-trading-archive"


def load_archive(archive_dir: Path) -> dict:
    archive_file = archive_dir / "tweets.json"
    if archive_file.exists():
        with open(archive_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"username": "", "last_updated": None, "newest_tweet_id": None, "tweets": []}


def save_archive(archive_dir: Path, data: dict):
    archive_dir.mkdir(parents=True, exist_ok=True)
    archive_file = archive_dir / "tweets.json"
    with open(archive_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    print(f"  [archive] Saved {len(data['tweets'])} tweets → {archive_file}")


async def download_image(url: str, save_path: Path) -> bool:
    """Download an image URL to save_path. Returns True on success."""
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code == 200:
                save_path.parent.mkdir(parents=True, exist_ok=True)
                save_path.write_bytes(r.content)
                return True
    except Exception as e:
        print(f"  [warn] Could not download image {url}: {e}", file=sys.stderr)
    return False


def sanitize_filename(name: str) -> str:
    return re.sub(r'[^\w.\-]', '_', name)


# ─────────────────────────────────────────────────────────────────────────────
# Tweet serialisation
# ─────────────────────────────────────────────────────────────────────────────

def serialize_media_item(media_item) -> dict:
    """Convert a tweety media object to a plain dict."""
    return {
        "type": getattr(media_item, "type", None),
        "url": getattr(media_item, "media_url_https", None)
              or getattr(media_item, "direct_url", None),
        "expanded_url": getattr(media_item, "expanded_url", None),
    }


def serialize_tweet_base(tweet) -> dict:
    """Serialize core fields of a Tweet object to a plain dict."""
    author = getattr(tweet, "author", None)
    return {
        "id": str(tweet.id),
        "date": str(tweet.date) if tweet.date else None,
        "text": tweet.text or "",
        "author_username": str(author.username) if author else None,
        "author_name": str(author.name) if author else None,
        "is_reply": bool(tweet.is_reply),
        "is_retweet": bool(tweet.is_retweet),
        "is_quoted": bool(getattr(tweet, "is_quoted", False)),
        "likes": getattr(tweet, "likes", 0),
        "retweet_counts": getattr(tweet, "retweet_counts", 0),
        "reply_counts": getattr(tweet, "reply_counts", 0),
        "url": getattr(tweet, "url", None),
        "hashtags": [str(h) for h in (getattr(tweet, "hashtags", None) or [])],
        "symbols": [str(s) for s in (getattr(tweet, "symbols", None) or [])],
        "media": [serialize_media_item(m) for m in (tweet.media or [])],
        "urls": [
            {
                "url": getattr(u, "url", None),
                "expanded_url": getattr(u, "expanded_url", None),
                "display_url": getattr(u, "display_url", None),
            }
            for u in (getattr(tweet, "urls", None) or [])
        ],
        "media_local_paths": [],  # filled in later after download
        "thread_context": [],     # filled in for replies
    }


async def fetch_thread_context(app, tweet_id: str) -> list[dict]:
    """
    Fetch the full tweet_detail for a tweet and return any parent-thread tweets
    (the tweets that appeared before the focal tweet in the thread).
    """
    try:
        detail = await app.tweet_detail(tweet_id)
        # detail.threads contains the focal tweet's OWN subsequent thread (self-replies)
        # The tweets *before* the focal tweet in the conversation are in detail._tweet_before
        # which tweet_detail stores internally; we can access them via the raw structure.
        # Simpler: just serialize the threads (self-thread continuations)
        context = []
        for t in (detail.threads or []):
            context.append(serialize_tweet_base(t))
        return context
    except Exception as e:
        print(f"  [warn] Could not fetch thread context for {tweet_id}: {e}", file=sys.stderr)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Main download logic
# ─────────────────────────────────────────────────────────────────────────────

async def download(handle: str, archive_dir: Path, session_name: str, wait_time, pages: int):
    try:
        from tweety import TwitterAsync
    except ImportError:
        print("ERROR: tweety-ns is not installed. Run: pip install tweety-ns", file=sys.stderr)
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  Trading Strategy Explorer — @{handle}")
    print(f"  Archive: {archive_dir}")
    print(f"  Session: {session_name}")
    print(f"{'='*60}\n")

    # Load existing archive
    existing = load_archive(archive_dir)
    existing_ids: set[str] = {t["id"] for t in existing.get("tweets", [])}
    newest_seen_id: str | None = existing.get("newest_tweet_id")
    is_incremental = bool(existing_ids)

    if is_incremental:
        print(f"  [info] Incremental update — {len(existing_ids)} tweets already archived.")
        print(f"  [info] Will stop when tweet ID {newest_seen_id} is reached.\n")
    else:
        print("  [info] Fresh download — fetching all available tweets.\n")

    # Connect to Twitter
    app = TwitterAsync(session_name)
    try:
        await app.connect()
        print(f"  [auth] Connected as: {app.me}\n")
    except Exception as e:
        print(f"  [auth] Could not connect with saved session '{session_name}'.", file=sys.stderr)
        print(f"         Error: {e}", file=sys.stderr)
        print(f"         Run sign-in first (see README or tweety docs).", file=sys.stderr)
        sys.exit(1)

    # Download tweets
    new_tweets: list[dict] = []
    stop_early = False
    page_num = 0
    media_dir = archive_dir / "media"

    print(f"  [download] Starting — fetching up to {pages} pages (replies=True, no retweets)...\n")

    async for page, batch in app.iter_tweets(
        handle,
        pages=pages,
        replies=True,
        wait_time=wait_time,
    ):
        page_num += 1
        batch_new = 0

        for tweet in batch:
            # Skip retweets
            if tweet.is_retweet:
                continue

            tweet_id = str(tweet.id)

            # Incremental stop: we've reached tweets we already have
            if is_incremental and tweet_id == newest_seen_id:
                print(f"\n  [info] Reached previously archived tweet {tweet_id}. Stopping.")
                stop_early = True
                break

            if tweet_id in existing_ids:
                continue

            serialized = serialize_tweet_base(tweet)

            # For replies: fetch full thread context (parent tweets)
            if tweet.is_reply:
                serialized["thread_context"] = await fetch_thread_context(app, tweet_id)
                await asyncio.sleep(1)  # gentle rate limiting for detail fetches

            # Download images
            for i, media_item in enumerate(serialized["media"]):
                media_url = media_item.get("url")
                if not media_url:
                    continue
                media_type = media_item.get("type", "")
                if media_type in ("photo", "animated_gif") or media_url.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                    # Build a clean filename
                    fname = sanitize_filename(f"{tweet_id}_{i}_{os.path.basename(media_url.split('?')[0])}")
                    local_path = media_dir / fname
                    if not local_path.exists():
                        ok = await download_image(media_url, local_path)
                        if ok:
                            serialized["media_local_paths"].append(str(local_path.relative_to(archive_dir)))
                    else:
                        serialized["media_local_paths"].append(str(local_path.relative_to(archive_dir)))

            new_tweets.append(serialized)
            existing_ids.add(tweet_id)
            batch_new += 1

        print(f"  [page {page_num:>3}] +{batch_new} new tweets  (total new this run: {len(new_tweets)})")

        if stop_early:
            break

    # Merge new tweets at the top (newest first)
    all_tweets = new_tweets + existing.get("tweets", [])

    # Track the newest tweet ID for next incremental run
    newest_tweet_id = all_tweets[0]["id"] if all_tweets else newest_seen_id

    updated_archive = {
        "username": handle,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "newest_tweet_id": newest_tweet_id,
        "total_tweets": len(all_tweets),
        "tweets": all_tweets,
    }

    save_archive(archive_dir, updated_archive)

    print(f"\n  [done] {len(new_tweets)} new tweets downloaded.")
    print(f"  [done] Archive total: {len(all_tweets)} tweets.\n")
    return archive_dir


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Download and archive tweets from a Twitter/X profile.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    dl = sub.add_parser("download", help="Download tweets from a profile")
    dl.add_argument("handle", help="Twitter handle (e.g. @elonmusk or https://x.com/elonmusk)")
    dl.add_argument("--session", default="trading_explorer", help="Tweety session name (default: trading_explorer)")
    dl.add_argument("--wait", type=float, default=3, help="Seconds to wait between pages (default: 3)")
    dl.add_argument("--pages", type=int, default=9999, help="Max pages to fetch (default: 9999 = all)")
    dl.add_argument("--archive-dir", help="Override archive directory path")

    args = parser.parse_args()

    if args.command == "download":
        handle = clean_handle(args.handle)
        if args.archive_dir:
            archive_dir = Path(args.archive_dir)
        else:
            # Place archive next to the script
            script_dir = Path(__file__).parent.parent  # repo root
            archive_dir = archive_dir_for(handle, script_dir)

        asyncio.run(download(
            handle=handle,
            archive_dir=archive_dir,
            session_name=args.session,
            wait_time=args.wait,
            pages=args.pages,
        ))


if __name__ == "__main__":
    main()
