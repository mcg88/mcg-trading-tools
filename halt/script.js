$(document).ready(function() {
    function validateTime(timeStr) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
        return timeRegex.test(timeStr);
    }

    function addMinutesToTime(timeStr, minutes) {
        const [hours, mins, secs] = timeStr.split(':').map(Number);
        const date = new Date(2024, 0, 1, hours, mins, secs);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toTimeString().slice(0, 8);
    }

    function isTimeGreater(time1, time2) {
        const [h1, m1, s1] = time1.split(':').map(Number);
        const [h2, m2, s2] = time2.split(':').map(Number);
        const date1 = new Date(2024, 0, 1, h1, m1, s1);
        const date2 = new Date(2024, 0, 1, h2, m2, s2);
        return date1 <= date2;
    }

    function isTimePast(timeToCheck, currentTime) {
        const [h1, m1, s1] = timeToCheck.split(':').map(Number);
        const [h2, m2, s2] = currentTime.split(':').map(Number);
        
        const date1 = new Date(2024, 0, 1, h1, m1, s1);
        const date2 = new Date(2024, 0, 1, h2, m2, s2);
        
        return date1 < date2;
    }

    function showError(message) {
        const errorDiv = $('#errorMessage');
        errorDiv.text(message).removeClass('d-none');
    }

    function hideError() {
        $('#errorMessage').addClass('d-none');
    }

    function getCurrentTime() {
        const now = new Date();
        return now.toTimeString().slice(0, 8);
    }

    function calculateLowerPrice(haltPrice, percentDecrease) {
        const lowerPrice = haltPrice - (haltPrice * percentDecrease);
        return Math.max(0, lowerPrice).toFixed(2);
    }

    function checkPriceInBand(indicativePrice, lowerBand, upperBand) {
        return indicativePrice >= parseFloat(lowerBand) && indicativePrice <= parseFloat(upperBand);
    }

    function generateTable(e) {
        e.preventDefault();
        
        const startTime = $('#timeInput').val();
        const haltPrice = parseFloat($('#priceInput').val());
        const indicativePrice = parseFloat($('#indicativePriceInput').val());
        
        // Validation
        if (!validateTime(startTime)) {
            showError('Please enter a valid time in HH:MM:SS format');
            return;
        }
        if (isNaN(haltPrice) || haltPrice <= 0) {
            showError('Please enter a valid positive price');
            return;
        }

        hideError();
        const tableRows = [];
        let currentTime = startTime;
        const endTime = '15:49:59';
        let rowCount = 0;
        const currentTimeStr = getCurrentTime();
        let firstValidTime = null;

        // Start with first increment
        currentTime = addMinutesToTime(currentTime, 5);

        // Track final upper band price for checking auction satisfaction
        let finalUpperPrice;

        while (isTimeGreater(currentTime, endTime)) {
            const upperBandPrice = (haltPrice + (haltPrice * 0.05 * (rowCount + 1))).toFixed(2);
            const lowerBandPrice = calculateLowerPrice(haltPrice, 0.05 * (rowCount + 1));
            const isPastTime = isTimePast(currentTime, currentTimeStr);
            
            // Check if indicative price is within bands
            const isPriceValid = !isNaN(indicativePrice) && 
                               checkPriceInBand(indicativePrice, lowerBandPrice, upperBandPrice) &&
                               !firstValidTime; // Only mark as valid if it's the first valid time
            
            if (isPriceValid) {
                firstValidTime = currentTime;
            }
            
            const classes = [];
            if (isPastTime) classes.push('past-time');
            if (isPriceValid) classes.push('valid-price-row');
            
            tableRows.push(`
                <tr class="${classes.join(' ')}">
                    <td>${currentTime}</td>
                    <td>$${lowerBandPrice}</td>
                    <td>$${upperBandPrice}</td>
                </tr>
            `);
            currentTime = addMinutesToTime(currentTime, 5);
            rowCount++;
        }

        // Add final row with 10% increase/decrease
        if (tableRows.length > 0) {
            const lastUpperPrice = parseFloat((haltPrice + (haltPrice * 0.05 * rowCount)).toFixed(2));
            finalUpperPrice = (lastUpperPrice * 1.10).toFixed(2);
            const finalLowerPrice = calculateLowerPrice(haltPrice, 0.05 * rowCount * 1.10);
            const isPastTime = isTimePast('15:50:00', currentTimeStr);
            
            const isPriceValid = !isNaN(indicativePrice) && 
                               checkPriceInBand(indicativePrice, finalLowerPrice, finalUpperPrice) &&
                               !firstValidTime;
            
            if (isPriceValid) {
                firstValidTime = '15:50:00';
            }
            
            const classes = ['final-row'];
            if (isPastTime) classes.push('past-time');
            if (isPriceValid) classes.push('valid-price-row');
            
            tableRows.push(`
                <tr class="${classes.join(' ')}">
                    <td>15:50:00</td>
                    <td>$${finalLowerPrice}</td>
                    <td>$${finalUpperPrice}</td>
                </tr>
            `);
        }

        // Show valid time message if applicable
        const validTimeMessage = $('#validTimeMessage');
        if (!isNaN(indicativePrice)) {
            if (indicativePrice <= 0 || indicativePrice > parseFloat(finalUpperPrice)) {
                validTimeMessage
                    .html('The auction will not be satisfied at these prices')
                    .removeClass('d-none alert-success')
                    .addClass('alert-warning');
            } else if (firstValidTime) {
                validTimeMessage
                    .html(`The earliest time the indicative price ($${indicativePrice.toFixed(2)}) falls within the bands is: <strong>${firstValidTime}</strong>`)
                    .removeClass('d-none alert-warning')
                    .addClass('alert-success');
            } else {
                validTimeMessage.addClass('d-none');
            }
        } else {
            validTimeMessage.addClass('d-none');
        }

        // Update table
        const tbody = $('#resultTable tbody');
        tbody.html(tableRows.join(''));
        $('#resultTable').removeClass('d-none');

        // Set up automatic refresh of highlighting
        setInterval(function() {
            const newCurrentTime = getCurrentTime();
            $('#resultTable tbody tr').each(function() {
                const rowTime = $(this).find('td:first').text();
                const isPastTime = isTimePast(rowTime, newCurrentTime);
                $(this).toggleClass('past-time', isPastTime);
            });
        }, 1000);
    }

    // Handle form submission (both button click and Enter key)
    $('#calculatorForm').on('submit', generateTable);
});