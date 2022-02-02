var console = window.console || { log: function() {} };

// midi commands constants
const MIDI_NOTE_OFF_CMD = 0x8;
const MIDI_NOTE_ON_CMD = 0x9;
export const MIDI_CC_CMD = 0xB;
const MIDI_PC_CMD = 0xC;
const MIDI_PB_CMD = 0xE;

// midi commands labels constants
const MIDI_NOTE_OFF_LABEL = "Note Off";
const MIDI_NOTE_ON_LABEL = "Note On";
const MIDI_CC_LABEL = "CC";
export const MIDI_NRPN_LABEL = "NRPN";
export const MIDI_RPN_LABEL = "RPN";
const MIDI_PC_LABEL = "PC";
const MIDI_PB_LABEL = "PB";

// midi constants for NRPN and RPN LSB/MSB params and values
export const NRPN_LSB = 0x62;
export const NRPN_MSB = 0x63;
export const RPN_LSB = 0x64;
export const RPN_MSB = 0x65;
export const DATA_ENTRY_LSB = 0x26;
export const DATA_ENTRY_MSB = 0x6;

// logical masks for command and channel
const MIDI_CMD_MASK = 0xF0;
const MIDI_CHN_MASK = 0x0F;

// helper functions
const getMidiCommand = (data) => { return ( (data & MIDI_CMD_MASK) >> 4) };
const getMidiChannel = (data) => { return ( data & MIDI_CHN_MASK) };

export const getMidiCommandAndChannel = (data) => {
    let cmd = (data & MIDI_CMD_MASK) >> 4;
    let chn = data & MIDI_CHN_MASK;
    return {command: cmd, channel: chn+1}; // chn from 1-16
}

export const isMidiMessage = (data) => {
    console.log('data:', data)
    let cmd = getMidiCommand(data);
    console.log('cmd:', cmd);
    return cmd >= MIDI_NOTE_OFF_CMD && cmd <= MIDI_PB_CMD;
}

export const isCC = (cmd) => {
    return cmd === MIDI_CC_CMD;
}

export const isPC = (cmd) => {
    return cmd === MIDI_PC_CMD;
}

export const isPB = (cmd) => {
    return cmd === MIDI_PB_CMD;
}

export const isNRPNLSBParam = (param) => {
    return param === NRPN_LSB;
}

export const isNRPNMSBParam = (param) => {
    return param === NRPN_MSB;
}

export const isRPNLSBParam = (param) => {
    return param === RPN_LSB;
}

export const isRPNMSBParam = (param) => {
    return param === RPN_MSB;
}

export const isDataEntryLSB = (param) => {
    return param === DATA_ENTRY_LSB;
}

export const isDataEntryMSB = (param) => {
    return param === DATA_ENTRY_MSB;
}

export const getMessageType = (command) => {
    let messageType = null;
    switch (command) {
        case MIDI_NOTE_OFF_CMD:
            messageType = MIDI_NOTE_OFF_LABEL;
            break;
        case MIDI_NOTE_ON_CMD:
            messageType = MIDI_NOTE_ON_LABEL;
            break;
        case MIDI_CC_CMD:
            messageType = MIDI_CC_LABEL;
            break;
        case MIDI_PC_CMD:
            messageType = MIDI_PC_LABEL;
            break;
        case MIDI_PB_CMD:
            messageType = MIDI_PB_LABEL;
            break;
        default:
            break;
    }
    return messageType;
}