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

    function generateTable(e) {
        e.preventDefault();
        
        const startTime = $('#timeInput').val();
        const startPrice = parseFloat($('#priceInput').val());
        
        // Validation
        if (!validateTime(startTime)) {
            showError('Please enter a valid time in HH:MM:SS format');
            return;
        }
        if (isNaN(startPrice) || startPrice <= 0) {
            showError('Please enter a valid positive price');
            return;
        }

        hideError();
        const tableRows = [];
        let currentTime = startTime;
        const endTime = '15:49:59';
        let rowCount = 0;
        const currentTimeStr = getCurrentTime();

        // Generate regular rows
        while (isTimeGreater(currentTime, endTime)) {
            const price = (startPrice + (startPrice * 0.05 * rowCount)).toFixed(2);
            const isPastTime = isTimePast(currentTime, currentTimeStr);
            
            const classes = isPastTime ? 'past-time' : '';
            tableRows.push(`
                <tr class="${classes}">
                    <td>${currentTime}</td>
                    <td>$${price}</td>
                </tr>
            `);
            currentTime = addMinutesToTime(currentTime, 5);
            rowCount++;
        }

        // Add final row with 10% increase
        if (tableRows.length > 0) {
            const lastPrice = parseFloat((startPrice + (startPrice * 0.05 * (rowCount - 1))).toFixed(2));
            const finalPrice = (lastPrice * 1.10).toFixed(2);
            const isPastTime = isTimePast('15:50:00', currentTimeStr);
            
            const classes = ['final-row'];
            if (isPastTime) classes.push('past-time');
            
            tableRows.push(`
                <tr class="${classes.join(' ')}">
                    <td>15:50:00</td>
                    <td>$${finalPrice}</td>
                </tr>
            `);
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
        }, 1000); // Update every second
    }

    // Handle form submission (both button click and Enter key)
    $('#calculatorForm').on('submit', generateTable);
});