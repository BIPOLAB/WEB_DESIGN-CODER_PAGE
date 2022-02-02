var console = window.console || { log: function () { } };

function onMIDISuccess(midiAccess, callback) {
    console.log(midiAccess);
    let inputs = Array.from(midiAccess.inputs.values());
    let outputs = Array.from(midiAccess.outputs.values());

    console.log(inputs);
    console.log(outputs);

    callback(inputs, outputs, midiAccess);
}

function onMIDIFailure(msg) {
    console.log('Could not access midi devices!', msg);
}

export function detectDevices(callback) {
    if (!navigator.requestMIDIAccess) {
        alert('WebMidiAPI not enabled on this browser!');
        return;
    }

    navigator.requestMIDIAccess({ sysex: true }).then((midiAccess) => { onMIDISuccess(midiAccess, callback) }, onMIDIFailure);
}

