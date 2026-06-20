    // --- AUTOSCROLL LOGIC (Mini Scroll - No Focus) ---

    function initializeAutoscroll(speed) {
        // Select all data rows (exclude header if it was somehow selected, though querySelectorAll on tbody handles this)
        var rows = scrollWrapper.querySelectorAll("tbody tr");
        
        // If there is only 1 row or no rows, no need to scroll
        if (rows.length <= 1) {
            if (window.parent && typeof window.parent.postMessage === "function") {
                window.parent.postMessage("stop", "*");
            }
            return;
        }

        var currentIndex = 0;
        
        // Calculate the height of one row to know how much to scroll
        // We assume rows are roughly same height, or we scroll to the specific element
        var rowHeight = rows[0].offsetHeight; 
        // Add margin/padding spacing if defined in CSS (border-spacing + padding)
        // In your CSS: border-spacing: 0 4px; padding: 16px... 
        // It's safer to scroll to the element directly using scrollIntoView or calculate offsetTop

        var scrollInterval = setInterval(function() {
            if (!document.getElementById("scroll-wrapper")) {
                clearInterval(scrollInterval);
                return;
            }

            currentIndex++;

            // Loop back to start if we reach the end
            if (currentIndex >= rows.length) {
                currentIndex = 0;
            }

            var targetRow = rows[currentIndex];

            // Calculate position relative to the wrapper
            var wrapperRect = scrollWrapper.getBoundingClientRect();
            var rowRect = targetRow.getBoundingClientRect();
            
            // Calculate the new scrollTop value
            // We want the row to be visible. 
            // Simple approach: Scroll so the row is near the top, or centered.
            // Let's center it for better visibility in a "mini" view
            var thElement = scrollWrapper.querySelector("thead");
            var headerHeight = thElement ? thElement.offsetHeight : 0;
            
            // Current scroll position + (Row Top relative to wrapper) - (Wrapper Height / 2) + (Row Height / 2)
            var relativeRowTop = targetRow.offsetTop; 
            var scrollTarget = relativeRowTop - (wrapperRect.height / 2) + (rowRect.height / 2);

            // Apply smooth scroll
            scrollWrapper.scrollTo({ 
                top: Math.max(0, scrollTarget), 
                behavior: 'smooth' 
            });

        }, speed);
    }