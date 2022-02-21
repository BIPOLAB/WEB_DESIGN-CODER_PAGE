const drop__menu = document.querySelector(".drop__menu"),
    drop__modeBtn = drop__menu.querySelector(".drop__modeBtn");
    drop__modeBtn.addEventListener("click", () => {
    drop__menu.classList.toggle("active");
});
const channel__dropMenu = document.querySelector(".channel__dropMenu"),
    drop__channelBtn = channel__dropMenu.querySelector(".channel__dropBtn");
    drop__channelBtn.addEventListener("click", () => {
        channel__dropMenu.classList.toggle("toggle__dropChannel");
});

const note__dropMenu = document.querySelector(".note__dropMenu"),
    drop__noteBtn = note__dropMenu.querySelector(".note__dropBtn");
    drop__noteBtn.addEventListener("click", () => {
        note__dropMenu.classList.toggle("toggle__dropNote");
});

let dial1 = new Knob({
    size: "xlarge", 
    type: "LittlePhatty", 
    lowVal: 0, 
    highVal: 100, 
    value: 75, 
    sensitivity: 1,  
    lblTxtColor: "black",
    id: "panKnob"
    
 });
 dial1.getValue(20); //get dial 1's value
 function knobChanged(id, val) {
    console.log(`knob with ID: ${id} change to ${val}`);
    /* if (id == knob1) {
      ..do something
    } else if (id == knob2) {
      ..do something else
    }  */
  }