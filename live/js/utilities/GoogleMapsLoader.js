/**
 * Asynchronously loads the Google Maps API into the window object safely.
 */
export class GoogleMapsLoader {
    /**
     * Injects the Google Maps script and resolves a promise when the global object is ready.
     * Prevents duplicate script injections.
     * @param {string} apiKey - The required API key.
     * @returns {Promise<Object>} The window.google.maps object.
     */
    static async load(apiKey) {
        // 1. If already fully loaded, return immediately
        if (window.google && window.google.maps && window.google.maps.Map) {
            return window.google.maps;
        }

        return new Promise((resolve, reject) => {
            // 2. Prevent duplicate script injections if called twice quickly
            if (document.getElementById('google-maps-script')) {
                const check = setInterval(() => {
                    if (window.google && window.google.maps && window.google.maps.Map) {
                        clearInterval(check);
                        resolve(window.google.maps);
                    }
                }, 100);
                return;
            }

            // 3. Set up the global callback that Google's script will trigger when ready
            window.__googleMapsCallback = () => {
                resolve(window.google.maps);
                delete window.__googleMapsCallback;
            };

            // 4. Inject the traditional script tag
            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__googleMapsCallback&loading=async&v=weekly`;
            script.async = true;
            script.defer = true;
            script.onerror = () => reject(new Error("Failed to load Google Maps API"));
            
            document.head.appendChild(script);
        });
    }
}