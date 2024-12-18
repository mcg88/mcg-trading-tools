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
        const currentTimeStr = getCurrentTime();
        let firstValidTime = null;

        // Calculate increment value (rounded to 2 significant figures)
        const increment = Number((haltPrice * 0.05).toPrecision(3));

        // Start with first increment at 5 minutes
        currentTime = addMinutesToTime(currentTime, 5);
        
        // First row values
        let lowerBand = Math.max(0, haltPrice - (2 * increment));
        let upperBand = haltPrice + (2 * increment);

        while (isTimeGreater(currentTime, endTime)) {
            lowerBand = Math.max(0, lowerBand.toFixed(2));
            upperBand = upperBand.toFixed(2);
            
            // Check if indicative price is within bands
            const isPriceValid = !isNaN(indicativePrice) && 
                               checkPriceInBand(indicativePrice, lowerBand, upperBand) &&
                               !firstValidTime;
            
            if (isPriceValid) {
                firstValidTime = currentTime;
            }
            
            const classes = [];
            if (isTimePast(currentTime, currentTimeStr)) classes.push('past-time');
            if (isPriceValid) classes.push('valid-price-row');
            
            tableRows.push(`
                <tr class="${classes.join(' ')}">
                    <td>${currentTime}</td>
                    <td>$${lowerBand}</td>
                    <td>$${upperBand}</td>
                </tr>
            `);

            // Calculate next row values
            lowerBand = Math.max(0, parseFloat(lowerBand) - increment);
            upperBand = parseFloat(upperBand) + increment;
            currentTime = addMinutesToTime(currentTime, 5);
        }

        // Add final row (15:50) with 90%/110% of previous row
        if (tableRows.length > 0) {
            
	    if (parseFloat(lowerBand) > 0){
		const lastLowerBand = parseFloat(lowerBand)+ increment;
		}
	else{
		const lastLowerBand = parseFloat(lowerBand);
	}
		
            const lastUpperBand = parseFloat(upperBand)-increment;
            
            const finalLowerBand = Math.max(0, (lastLowerBand * 0.9)).toFixed(2);
            const finalUpperBand = (lastUpperBand * 1.1).toFixed(2);
            
            const isPastTime = isTimePast('15:50:00', currentTimeStr);
            const isPriceValid = !isNaN(indicativePrice) && 
                               checkPriceInBand(indicativePrice, finalLowerBand, finalUpperBand) &&
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
                    <td>$${finalLowerBand}</td>
                    <td>$${finalUpperBand}</td>
                </tr>
            `);
        }

        // Show valid time message if applicable
        const validTimeMessage = $('#validTimeMessage');
        if (!isNaN(indicativePrice)) {
            if (indicativePrice <= 0 || indicativePrice > parseFloat(upperBand)) {
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
