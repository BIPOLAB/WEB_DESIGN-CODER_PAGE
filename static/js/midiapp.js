console.clear()

if(navigator.requestMIDIAccess) {
  navigator.requestMIDIAccess({
    sysex: false
  }).then(function(midiAccess) {
    midiAccess.onstatechange = function() {
      populateIO(midiAccess)
    };
    
    populateIO(midiAccess);
  });
}

function populateIO(midiAccess) {
  window.midiAccess = midiAccess;
  populateInputs(midiAccess);
  populateOutputs(midiAccess);
};

function populateInputs(midiAccess) {
  var select = document.getElementById('inputs');
  select.innerHTML = '';
  midiAccess.inputs.forEach(function(input) {
    var option = document.createElement('option');
    option.setAttribute('value', input.id);
    option.innerText = input.name;
    select.appendChild(option);
  });
  
  var initialize = function() {
    window.input = midiAccess.inputs.get(select.value);
    if(window.input) {
      window.input.onmidimessage = midiMessage;
    }
  };
  
  select.addEventListener('change', initialize);
  initialize();
};

function populateOutputs(midiAccess) {
  var select = document.getElementById('outputs');
  select.innerHTML = '';
  midiAccess.outputs.forEach(function(output) {
    var option = document.createElement('option');
    option.setAttribute('value', output.id);
    option.innerText = output.name;
    select.appendChild(option);
  });
  
  select.addEventListener('change', function() {
    window.output = midiAccess.outputs.get(select.value);
  });
  
  window.output = midiAccess.outputs.get(select.value);
};

function midiMessage(message) {
  if(message.data[0] === 248) return; // ignore clocking messages
  
  console.log(message.data)
}