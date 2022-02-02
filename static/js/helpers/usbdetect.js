// navigator.usb.requestDevice({ filters: [{ 'vendorId': 0x1EAF }] }).then(console.log)


document.addEventListener('DOMContentLoaded', async () => {
    let devices = await navigator.requestDevice({
        filters: [{ 'vendorId': 0x1EAF }]
    }).then(console.log);
});
navigator.addEventListener('connect', event => {
    // Add |event.device| to the UI.
});

navigator.addEventListener('disconnect', event => {
    // Remove |event.device| from the UI.
});