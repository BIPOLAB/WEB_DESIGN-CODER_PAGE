import React, { Component } from 'react';
import { withSnackbar } from 'notistack';
import ReactTooltip from 'react-tooltip';
import { populateConfig } from './helpers/config';
import { warnIfOldFirmware } from './helpers/versionManager';
import {
    BACKEND_URL,
    INTRO_VIDEO_ID
} from './helpers/urls';
import { getHardwareId } from './helpers/hardwareId'
import { detectDevices } from './helpers/webmidi';
import LoadingOverlay from 'react-loading-overlay';
import { downloadBlob, prepareJsonBlob, createFileInput } from './helpers/utils';
import {
    getMidiCommandAndChannel,
    getMessageType,
    isMidiMessage,
    isCC,
    isPB,
    isPC,
    MIDI_NRPN_LABEL,
    MIDI_RPN_LABEL,
    isNRPNLSBParam,
    isNRPNMSBParam,
    isRPNLSBParam,
    isRPNMSBParam,
    isDataEntryLSB,
    isDataEntryMSB
} from './helpers/midi';
import {
    INFO_KILOMUX_CONNECTED,
    INFO_CAPTURE_TOGGLE,
    INFO_OPENING_HW_CONFIG,
    INFO_BANK_SHIFTER_IN_USE,
    INFO_BANK_CAPTURE_ON,
    INFO_LOADING_CONFIG_FROM_ACCOUNT,
    INFO_LOADING_DEFAULT_CONFIG,
    INFO_LOADING_CTRL_CONFIG,
    INFO_VALIDATING_CONFIG,
    INFO_INVALID_HW_CONFIG,
    INFO_SENDING_RESET_COMMAND,
    WARNING_NO_DEVICE_SELECTED,
    SUCCESS_PORTS_REFRESHED,
    SUCCESS_CONFIG_UPLOADED,
    SUCCESS_CONFIG_READY_TO_DOWNLOAD,
    SUCCESS_CONFIG_LOADED,
    SUCCESS_BACKEND_CONN_UP,
    SUCCESS_CAPTURE_MODE_SWITCHED,
    ERROR_WEBSOCKET_CLOSED,
    ERROR_HANDSHAKE_NO_DEVICE,
    ERROR_HANDSHAKE_SERVER_NO_ANSWER,
    ERROR_NO_ACK_RECEIVED,
    ERROR_CONFIG_INVALID_PID,
    ERROR_CONFIG_DEVICE_NAME,
    ERROR_CONFIG_USB_SERIAL,
    ERROR_FAILED_DEFAULT_CONFIG,
    ERROR_FAILED_BUILDING_CONFIG,
    ERROR_SENDING_CONFIG,
    ERROR_BACKEND_REQUEST_SPECIAL_COMMAND,
    ERROR_BACKEND_SAVING_CONFIG,
    ERROR_BACKEND_REQUESTING_BLOCK_COMMAND,
    ERROR_BACKEND_REQUESTING_GET_CONFIG_COMMANDS,
    ERROR_CONFIG_INVALID,
    ERROR_GETTING_BLOCK_ZERO,
    ERROR_WAITING_ACK_FOR_CAPTURE_MODE
} from './helpers/alerts';

import _ from 'lodash';
import uuid from 'react-uuid';

import LandingPage from './components/Main/LandingPage';
import Toolbar from './components/Toolbar/Toolbar';
import Footer from './components/Footer/Footer';
import HardwareConfig from './components/Main/HardwareConf';
import ElementsView from './components/Main/ElementsView';
import SideDrawer from './components/SideDrawer/SideDrawer';
import DrawerToggleButton from './components/SideDrawer/DrawerToggleButton';
import SelectAndLoadDialog from './components/Misc/SelectAndLoadDialog';
import ModalVideo from 'react-modal-video';
import moment from 'moment-timezone';
import './App.css';
import '../node_modules/react-modal-video/scss/modal-video.scss';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// eslint-disable-next-line no-unused-vars
var console = window.console || { log: function () { } };

const DEVICE_NAME_MAX_LENGTH = 15;
const DEVICE_SERIAL_MAX_LENGTH = 9;
const USB_PID_MAX = 65535;
const MAX_ACK_RETRIES = 3;
const COLOR_RANGE_OFF = 0;
const DEFAULT_BANK_COLOR = [0, 0, 0];
const DEFAULT_SWITCH_COLOR = [66, 245, 224];
const DEFAULT_DIGITAL_COLOR = [245, 66, 84];
const SYSEX_ACK = new Uint8Array([240, 121, 116, 120, 1, 247]);
const MAX_MONITOR_DATA_SIZE = 20;
const BANK_MODE = ['Momentary', 'Toggle'];
const BANK_NONE_ID = 0xFFFF;
const TZ = moment.tz.guess();

class App extends Component {
    constructor(props) {
        super(props);

        let webmidiEnabled = false;

        this.state = {
            'webmidiEnabled': webmidiEnabled,
            'midiAccess': null,
            'inputs': [],
            'outputs': [],
            'hiddenDevices': [],
            'kmxInputs': {},
            'kmxOutputs': {},
            'idsWithHandshakeSent': [],
            'idsDisconnected': [],
            'inputSelected': -1,
            'outputSelected': -1,
            'midiMergeOption': new Array(4).fill(0),
            'filter': 'encoder',    // TODO check this out (filter is duplicate)
            'showElementsOptions': ['Encoders', 'Digitals', 'Analogs', 'Feedbacks'],
            'drawerOpen': false,
            'drawerId': null,
            'drawerClass': '',
            'onHardwareConfig': false,
            'encoders': null,
            'digitals': null,
            'analogs': null,
            'feedbacks': null,
            'hwconfig': null,
            'configuring': false,
            'invalidHWConfig': false,
            'configLoaded': false,
            'rebooting': false,
            'detectingDevices': true,
            'banksNumber': 1,
            'currentBank': 0,
            'banks': {},
            'maxBanksNumber': 8,
            'defaultBank': null,
            'componentsCount': 0,
            'bankButtonsInUse': [],
            'shifterIdColor': {},
            'shifterIdBank': {},
            'onCapture': false,
            'bank_capture': null,
            'banksButtonsId': new Array(8).fill(0),
            'banksModes': new Array(8).fill(0),
            'currentElement': {
                'type': null,
                'properties': null,
            },
            'currentElementType': 'encoders',
            'sysexValidRequest': false,
            'sysexEchoMessage': null,
            'handshakeRequestReceived': {},
            'handshakeCommand': null,
            'handshakeSuccessful': false,
            'successfulConfig': false,
            'inputsAccess': null,
            'outputsAccess': null,
            'wsCheckAttempts': 3,
            'saving': false,
            'loading': false,
            'currentSerialNumber': null,
            'currentDeviceName': null,
            'firstConnection': true,
            'selectAndLoadOpen': false,
            'filter': {
                'type': null,
                'search': ''
            },
            'outOfSync': [],
            'outOfSyncInts': [],
            'partialUpdate': true,
            'monitoring': false,
            'monitorData': [{ timestamp: "-", name: "-", channel: "-", type: "-", param: "-", value: "-" }],
            'blinkIdx': -1,
            'blinkType': '',
            'takeoverOptions': ["None", "Pick Up", "Value Scaling"],
            'takeover': 0,
            'rainbow': true,
            'fwVersion': null,
            'remoteBanks': 0,
            'factoryReset': 0,
            'dumpStateOnStartup': 0,
            'rememberState': 0,
            'prevMidiParam': null,
            'nrpnOnGoing': false,
            'rpnOnGoing': false,
            'nrpnLSBparam': 0,
            'nrpnMSBparam': 0,
            'rpnLSBparam': 0,
            'rpnMSBparam': 0,
            'nrpnLSBvalue': 0,
            'nrpnMSBvalue': 0,
            'rpnLSBvalue': 0,
            'rpnMSBvalue': 0,
            'introVideoOpen': false,
            'ctrlVersionCache': {}, // {ctrlName1: (fw_version,hw_version),...}
            'encodersSelected': new Set(),
            'digitalsSelected': new Set(),
            'analogsSelected': new Set(),
        };

        this.ws_scheme = window.location.protocol === "https:" ? "wss" : "ws";

        this.backendWebSocket = new WebSocket(this.ws_scheme + '://' + BACKEND_URL + '/ws/kilowhat/ytxuser/');
        this.backendWebSocket.onopen = this.handleDetectDevices.bind(this);

        this.backendWebSocket.onmessage = this.handleBackendMessage.bind(this);
        this.backendWebSocket.onclose = this.handleBackendClose.bind(this);
        this.backendWebSocket.onerror = this.handleBackendError.bind(this);
        this.connectToBackend = this.connectToBackend.bind(this);
        this.sendPingToBackend = this.sendPingToBackend.bind(this);

        this.handleChange = this.handleChange.bind(this);
        this.handleShowChange = this.handleShowChange.bind(this);
        this.onExitHardwareConfig = this.onExitHardwareConfig.bind(this);
        this.onEnterHardwareConfig = this.onEnterHardwareConfig.bind(this);
        this.onConfigHardwareMapping = this.onConfigHardwareMapping.bind(this);
        this.handleElementSelected = this.handleElementSelected.bind(this);
        this.handlePropertyUpdate = this.handlePropertyUpdate.bind(this);

        // Load and Save Methods
        this.handleLoadFromDesktop = this.handleLoadFromDesktop.bind(this);
        this.handleLoadFromAccount = this.handleLoadFromAccount.bind(this);
        this.handleLoadFromController = this.handleLoadFromController.bind(this);
        this.handleSaveToAccount = this.handleSaveToAccount.bind(this);
        this.handleSaveToDesktop = this.handleSaveToDesktop.bind(this);
        this.handleDesktopFile = this.handleDesktopFile.bind(this);
        this.validateConfig = this.validateConfig.bind(this);

        // Banks methods

        this.MOMENTARY = 0;
        this.TOGGLE = 1;

        this.getBankButtonOptions = this.getBankButtonOptions.bind(this);
        this.handleBankButtonSelect = this.handleBankButtonSelect.bind(this);
        this.assignBankToEncoderSwitch = this.assignBankToEncoderSwitch.bind(this);
        this.allowEncoderSwitchConfig = this.allowEncoderSwitchConfig.bind(this);
        this.assignBankToDigital = this.assignBankToDigital.bind(this);
        this.allowDigitalConfig = this.allowDigitalConfig.bind(this);
        this.handleBankModeSelect = this.handleBankModeSelect.bind(this);
        this.handleBankMidiChSelect = this.handleBankMidiChSelect.bind(this);
        this.handleAddBank = this.handleAddBank.bind(this);
        this.handleBankSelect = this.handleBankSelect.bind(this);
        this.handleBankDelete = this.handleBankDelete.bind(this);
        this.handleBankDuplicate = this.handleBankDuplicate.bind(this);
        this.handlePassDataToBank = this.handlePassDataToBank.bind(this);

        this.handleSendToDevice = this.handleSendToDevice.bind(this);

        /* INPUT/OUTPUT */
        this.updateIO = this.updateIO.bind(this); // refreshes input output connected
        this.updateInput = this.updateInput.bind(this); // updates input selection in preferences
        this.updateOutput = this.updateOutput.bind(this); // updates output selection in preferences
        this.sendConfigToDevice = this.sendConfigToDevice.bind(this);
        this.onMIDIMessage = this.onMIDIMessage.bind(this);
        this.onMIDIStateChange = this.onMIDIStateChange.bind(this);
        this.sendSysexToBackend = this.sendSysexToBackend.bind(this);
        this.initiateHandshakeWithDevice = this.initiateHandshakeWithDevice.bind(this);

        this.updateMidiMerge = this.updateMidiMerge.bind(this);

        /* FILTER METHODS */
        this.onFilterSelected = this.onFilterSelected.bind(this);
        this.onFilterSearch = this.onFilterSearch.bind(this);

        /* UTILS */
        this.waitFor = this.waitFor.bind(this);

    }

    handleDetectDevices = () => {
        detectDevices(this.updateIO);
        this.backendWebSocket.onopen = null;
        this.backendPingInterval = setInterval(this.sendPingToBackend, 10000);
    }

    /*componentDidMount() {
        detectDevices(this.updateIO);
    }*/

    onMIDIMessage(event, name, output_id) {
        console.log('MIDI MESSAGE RECEIVED:', event)
        if (event.data[0] === 240 && event.data[event.data.length - 1] === 247) {
            //this.setState({sysexValidRequest: true, sysexEchoMessage: 'ack', handshakeSuccessful: true})
            console.log('>> SYSEX RECEIVED from ', name, ': ', event.data);
            if ((this.state.configuring || this.state.loading) && _.isEqual(event.data, SYSEX_ACK)) {
                this.setState({ [output_id]: true })
                return;
            }
            this.sendSysexToBackend(event.data, output_id);
            window.performance.mark('sysexSendEnd')
        }
        else if (isMidiMessage(event.data[0]) && this.state.monitoring) {

            let { command, channel } = getMidiCommandAndChannel(event.data[0]);
            let param = event.data[1];
            let value = event.data[2];
            console.log('>> MIDI MESSAGE ARRIVED:', event.data[0], event.data[1], event.data[2])
            this.handleMidiMonitorData(command, channel, param, value);
        }
    }

    handleMidiMonitorData = (command, channel, param, value) => {
        let type = getMessageType(command);
        let prevParam = this.state.prevMidiParam;
        let nrpnOnGoing = this.state.nrpnOnGoing;
        let rpnOnGoing = this.state.rpnOnGoing;
        console.log(prevParam);
        console.log(nrpnOnGoing);
        console.log(rpnOnGoing);
        if (isCC(command)) {
            // nrpn begin
            if (isNRPNMSBParam(param) && !isNRPNMSBParam(prevParam)) {
                this.setState({ nrpnOnGoing: true, prevMidiParam: param, nrpnMSBparam: value })
                return;
            }
            else if (isNRPNLSBParam(param) && isNRPNMSBParam(prevParam) && nrpnOnGoing) {
                this.setState({ prevMidiParam: param, nrpnLSBparam: value })
                return;
            }
            else if (isDataEntryMSB(param) && isNRPNLSBParam(prevParam) && nrpnOnGoing) {
                this.setState({ prevMidiParam: param, nrpnMSBvalue: value })
                return;
            }
            else if (isDataEntryLSB(param) && isDataEntryMSB(prevParam) && nrpnOnGoing) {
                param = (this.state.nrpnMSBparam << 7) | this.state.nrpnLSBparam;
                value = (this.state.nrpnMSBvalue << 7) | value;
                type = MIDI_NRPN_LABEL;
                this.setState({ nrpnOnGoing: false, prevMidiParam: null, nrpnMSBparam: 0, nrpnLSBparam: 0, nrpnLSBvalue: 0, nrpnMSBvalue: 0 })
            }
            // nrpn end, rpn begin
            else if (isRPNMSBParam(param) && !isRPNMSBParam(prevParam)) {
                this.setState({ rpnOnGoing: true, prevMidiParam: param, rpnMSBparam: value })
                return;
            }
            else if (isRPNLSBParam(param) && isRPNMSBParam(prevParam) && rpnOnGoing) {
                this.setState({ prevMidiParam: param, rpnLSBparam: value })
                return;
            }
            else if (isDataEntryMSB(param) && isRPNLSBParam(prevParam) && rpnOnGoing) {
                this.setState({ prevMidiParam: param, rpnMSBvalue: value })
                return;
            }
            else if (isDataEntryLSB(param) && isDataEntryMSB(prevParam) && rpnOnGoing) {
                param = (this.state.rpnMSBparam << 7) | this.state.rpnLSBparam;
                value = (this.state.rpnMSBvalue << 7) | value;
                type = MIDI_RPN_LABEL;
                this.setState({ rpnOnGoing: false, prevMidiParam: null, rpnMSBparam: 0, rpnLSBparam: 0, rpnLSBvalue: 0, rpnMSBvalue: 0 })
            }
            // rpn end, just cc
            else {
                this.setState({ rpnOnGoing: false, nrpnOnGoing: false, prevMidiParam: null })
            }
        }
        else if (isPC(command)) {
            value = '-';
        }
        else if (isPB(command)) {
            value = ((value << 7) | param) - 8192;
            param = '-';
        }
        console.log(type, channel, param, value);
        this.setState((prevState) => {
            if (prevState.monitorData.length === (MAX_MONITOR_DATA_SIZE - 1)) {
                prevState.monitorData.pop(); // remove oldest element in monitor data
            }
            let timestamp = moment.utc().tz(TZ).format("HH:mm:ss.SSSS")
            return (
                {
                    monitorData: [{ timestamp: timestamp, name: this.state.currentDeviceName, channel: channel, type: type, param: param, value: value }].concat(prevState.monitorData)
                }
            )
        })
    }

    sendSysexToBackend(encoded_data, output_id) {
        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.setState({ configuring: false });
            this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: "error"
            })
            return;
        }
        let data = JSON.stringify(encoded_data);
        try {
            this.backendWebSocket.send(JSON.stringify(
                { 'message': { 'sysex': data, 'command': 'decode', 'output_id': output_id } }
            ));
        } catch (error) {
            console.log('Could not send sysex to backend', error)
            //this.backendConnInterval = setInterval(this.connectToBackend, 100);
        }
    }

    async waitFor(ms, state_key, condition) {
        let ms_elapsed = 0;
        while (!_.isEqual(this.state[state_key], condition) && ms_elapsed < ms) {
            await sleep(1);
            ms_elapsed += 10;
        }

        return _.isEqual(this.state[state_key], condition);
    }

    async initiateHandshakeWithDevice(output, wait) {
        let requestId = uuid();
        let secondsToWaitForKilomux = wait ? wait : 2000;
        if (!output) {
            if (this.state.inputSelected !== -1) {
                output = this.findOutputForCurrentDevice()
            }
        }

        if (!output) {
            this.props.enqueueSnackbar(ERROR_HANDSHAKE_NO_DEVICE, {
                variant: 'error'
            });
            return;
        }

        try {
            this.backendWebSocket.send(JSON.stringify(
                { 'message': { 'command': 'special-requests', 'subcommand': 'handshake', 'request_id': requestId } }
            ));
        } catch (error) {
            console.log('Could not send handshake to backend', error);
            return;
        }

        await this.waitFor(2000, requestId, true);

        if (!this.state[requestId]) {
            this.props.enqueueSnackbar(ERROR_HANDSHAKE_SERVER_NO_ANSWER, {
                variant: 'error'
            });
            return false;
        }

        this.setState({ [requestId]: false })

        try {
            this.sendSysexToDevice(this.state.handshakeCommand, output);
        } catch (error) {
            console.log('ERROR WHILE SENDING HANDSHAKE: ', error);
        }

        await this.waitFor(secondsToWaitForKilomux, output.id, true);

        let validRequest = this.state[output.id] === true;
        this.setState({ [output.id]: false });

        return validRequest;
    }

    requestFwVersion = async (output, wait) => {
        let requestId = uuid();
        let secondsToWaitForKilomux = wait ? wait : 2000;
        if (!output) {
            if (this.state.inputSelected !== -1) {
                output = this.findOutputForCurrentDevice()
            }
        }

        if (!output) {
            this.props.enqueueSnackbar(ERROR_HANDSHAKE_NO_DEVICE, {
                variant: 'error'
            });
            return;
        }

        try {
            this.backendWebSocket.send(JSON.stringify(
                { 'message': { 'command': 'special-requests', 'subcommand': 'firmware_version', 'request_id': requestId } }
            ));
        } catch (error) {
            console.log('Could not send firmware version request to backend', error);
            return;
        }

        await this.waitFor(2000, requestId, true);

        if (!this.state[requestId]) {
            this.props.enqueueSnackbar(ERROR_HANDSHAKE_SERVER_NO_ANSWER, {
                variant: 'error'
            });
            return false;
        }

        this.setState({ [requestId]: false })

        try {
            this.sendSysexToDevice(this.state.fwVersionCommand, output);
        } catch (error) {
            console.log('ERROR WHILE SENDING FIRMWARE VERSION REQUEST: ', error);
        }

        await this.waitFor(secondsToWaitForKilomux, output.id, true);

        let validRequest = this.state[output.id] === true;
        this.setState({ [output.id]: false });

        /*
        we set the results in state directly.
        if (validRequest) {
            return this.state.requestedFwVersion;
        }

        return null;
        */
    }

    refreshPorts = () => {
        this.setState(
            { refreshing: true }, () => { detectDevices(this.updateIO) }
        )
    }

    updateIO(inputs, outputs, midiAccess) {
        let hiddenDevices = [];
        midiAccess.inputs.forEach(function (entry, idx) {
            console.log(entry);
            let output = _.find(outputs, (theOutput) => {
                return theOutput.name === entry.name;
            })
            if (!output) {
                hiddenDevices.push(idx);
                console.log('>> No output find for input with name: ', entry.name)
                return
            }
            let output_id = output.id;
            console.log(output_id)

            entry.onmidimessage = (event) => { this.onMIDIMessage(event, entry.name, output_id) };
        }.bind(this));
        if (this.state.refreshing) {
            this.props.enqueueSnackbar(SUCCESS_PORTS_REFRESHED, {
                variant: "success"
            })
        }
        this.setState((prevState) => {
            let kmxOutputs = _.filter(outputs, (output, index) => { return true });
            let outputsNames = _.map(kmxOutputs, (value, index) => { return value.name });
            let kmxInputs = _.filter(inputs, (value, index) => { return true });
            let inputsNames = _.map(kmxInputs, (value, index) => { return value.name });
            if (prevState.midiAccess !== null && prevState.midiAccess !== undefined) {
                prevState.midiAccess.onmidistatechange = null;
            }
            return ({
                inputs: inputsNames,
                outputs: outputsNames,
                hiddenDevices: hiddenDevices,
                webmidiEnabled: true,
                inputsAccess: kmxInputs,
                outputsAccess: kmxOutputs,
                refreshing: false,
                detectingDevices: false,
                idsWithHandshakeSent: [],
                idsDisconnected: [],
                midiAccess: midiAccess,
            });
        }, () => { midiAccess.onstatechange = this.onMIDIStateChange; });
    }

    checkKMXDevice = async (output, wait) => {
        return await this.initiateHandshakeWithDevice(output, wait);
    }

    checkKMXVersions = async (output, wait) => {
        let fw_version = await this.requestFwVersion(output, wait);
        let hw_version = await this.requestHwVersion(output, wait);

        return [fw_version, hw_version]

    }

    async onMIDIStateChange(event) {
        let port = event.port;
        let { id, state, name, manufacturer, type, connection } = port;
        let wait = 2000;
        console.log('midi state change:', event)
        console.log('midiAccess:', this.state.midiAccess)
        if (type === 'input' && state === 'connected') {
            let inputIdx;
            let input = _.find(this.state.inputsAccess, (input, idx) => {
                if (input.id === id) {
                    inputIdx = idx;
                    return true
                }
                return false
            })
            if (input === undefined) {
                this.setState((prevState) => {
                    let inputsAccess = prevState.inputsAccess;
                    let inputs = prevState.inputs;
                    return {
                        inputsAccess: inputsAccess.concat(port),
                        inputs: inputs.concat(name)
                    }
                })
                return;
            }

            let outputIdx;
            let output = _.find(this.state.outputsAccess, (output, idx) => {
                if (output.name === input.name) {
                    outputIdx = idx;
                    return true;
                }
                return false;
            })
            if (output === undefined) return;
            if (this.state.idsWithHandshakeSent.includes(output.id)) return;
            if (this.state.idsDisconnected.includes(input.id)) {
                wait = 5000;
            }
            if (output !== undefined) {
                console.log('>> SENDING HANDSHAKE TO POTENTIAL KMX DEVICE:', output)
                let kmxDetected = false;
                console.log('>> OUTPUT PORT OPEN');

                kmxDetected = await this.checkKMXDevice(output, wait);
                console.log('>> KMX?:', kmxDetected, output, outputIdx)
                if (kmxDetected) {

                    this.props.enqueueSnackbar(INFO_KILOMUX_CONNECTED, {
                        variant: 'info',
                    })
                    let resendCapture = false;
                    this.setState((prevState) => {
                        // YGR Mangling with prevState is usually not a good idea.
                        // TODO refactor this using local variables for example,
                        // let idsWithHandshakeSent = prevState.idsWithHandshakeSent
                        if (!prevState.idsWithHandshakeSent.includes(output.id)) {
                            prevState.idsWithHandshakeSent = prevState.idsWithHandshakeSent.concat(output.id)
                        }
                        if ((prevState.firstConnection || this.state.currentDeviceName === null) && !this.state.rebooting) {
                            prevState.firstConnection = false;
                            prevState.selectAndLoadOpen = true;
                        }
                        if (this.state.rebooting && output.name.includes(this.state.hwConfigDeviceName)) {
                            prevState.rebooting = false;
                            prevState.currentDeviceName = output.name;
                            prevState.inputSelected = outputIdx;
                            resendCapture = prevState.capturing;
                        }
                        prevState.idsDisconnected = _.filter(prevState.idsDisconnected, (id) => { return id !== input.id })
                        prevState.hiddenDevices = _.filter(prevState.hiddenDevices, (idx) => { return idx !== inputIdx })
                        return {
                            idsWithHandshakeSent: prevState.idsWithHandshakeSent,
                            firstConnection: prevState.firstConnection,
                            selectAndLoadOpen: prevState.selectAndLoadOpen,
                            idsDisconnected: prevState.idsDisconnected,
                            rebooting: prevState.rebooting,
                            currentDeviceName: prevState.currentDeviceName,
                            inputSelected: prevState.inputSelected
                        }
                    }, () => resendCapture && this.sendCaptureRequestToBackend(true))
                } else {
                    output.close();
                    port.close();
                    this.setState((prevState) => {
                        if (!prevState.hiddenDevices.includes(inputIdx)) {
                            prevState.hiddenDevices = prevState.hiddenDevices.concat(inputIdx)
                        }
                        if (!prevState.idsWithHandshakeSent.includes(output.id)) {
                            prevState.idsWithHandshakeSent = prevState.idsWithHandshakeSent.concat(output.id)
                        }
                        return ({
                            hiddenDevices: prevState.hiddenDevices,
                            idsWithHandshakeSent: prevState.idsWithHandshakeSent

                        })
                    })
                }
            }
        } else if (type === 'input' && state === 'disconnected') {
            let inputIdx;
            port.onmidistatechange = null;
            let input = _.find(this.state.inputsAccess, (input, idx) => {
                if (input.id === id) {
                    inputIdx = idx;
                    return true
                }
                return false
            });
            if (input === undefined) return;

            let output = _.find(this.state.outputsAccess, (output, idx) => {
                return output.name === input.name;
            })
            output.onmidistatechange = null;
            if (this.state.idsWithHandshakeSent.includes(output.id)) {
                this.setState((prevState) => {
                    prevState.idsWithHandshakeSent = _.filter(prevState.idsWithHandshakeSent, (id) => { return id !== output.id })
                    return prevState;
                })
            }
            if (this.state.inputSelected === inputIdx) {
                this.setState({ inputSelected: -1, currentDeviceName: null, firstConnection: true })
            }
            if (!this.state.idsDisconnected.includes(input.id)) {
                this.setState((prevState) => {
                    prevState.idsDisconnected = prevState.idsDisconnected.concat(input.id)
                    return prevState;
                })
            }
            if (!this.state.hiddenDevices.includes(inputIdx)) {
                this.setState((prevState) => {
                    prevState.hiddenDevices = prevState.hiddenDevices.concat(inputIdx)
                    return prevState;
                })
            }
        } else if (type === 'output' && state === 'connected') {
            if (this.state.idsWithHandshakeSent.includes(id)) return;
            let outputIdx;
            let output = _.find(this.state.outputsAccess, (output, idx) => {
                if (output.id === id) {
                    outputIdx = idx;
                    return true
                }
                return false
            })
            if (output === undefined) {
                this.setState((prevState) => {
                    let outputsAccess = prevState.outputsAccess;
                    outputIdx = outputsAccess.length;
                    prevState.idsWithHandshakeSent = prevState.idsWithHandshakeSent.concat(id)
                    return {
                        outputsAccess: outputsAccess.concat(port)
                    }
                })
                let inputIdx;
                let input = _.find(this.state.inputsAccess, (input, idx) => {
                    if (input.name === port.name) {
                        inputIdx = idx;
                        return true
                    }
                    return false;
                });
                if (input === undefined) {
                    console.log(">> Did not find input matching output name: ", port.name)
                    return;
                }
                wait = 5000;
                output = port;
                input.onmidimessage = (event) => { this.onMIDIMessage(event, input.name, id) }
                console.log('>> SENDING HANDSHAKE TO POTENTIAL KMX DEVICE:', output)
                let kmxDetected = false;
                console.log('>> OUTPUT PORT OPEN');
                kmxDetected = await this.checkKMXDevice(output, wait);
                console.log('>> KMX?:', kmxDetected, output, outputIdx)
                if (kmxDetected) {
                    this.props.enqueueSnackbar(INFO_KILOMUX_CONNECTED, {
                        variant: 'info',
                    })
                    let resendCapture = false
                    this.setState((prevState) => {
                        if (!prevState.idsWithHandshakeSent.includes(output.id)) {
                            prevState.idsWithHandshakeSent = prevState.idsWithHandshakeSent.concat(output.id)
                        }
                        if ((prevState.firstConnection || this.state.currentDeviceName === null) && !this.state.rebooting) {
                            prevState.firstConnection = false;
                            prevState.selectAndLoadOpen = true;
                        }
                        if (this.state.rebooting && output.name.includes(this.state.hwConfigDeviceName)) {
                            prevState.rebooting = false;
                            prevState.currentDeviceName = output.name;
                            prevState.inputSelected = outputIdx;
                            resendCapture = prevState.capturing;
                        }
                        prevState.idsDisconnected = _.filter(prevState.idsDisconnected, (id) => { return id !== input.id })
                        prevState.hiddenDevices = _.filter(prevState.hiddenDevices, (idx) => { return idx !== inputIdx })
                        return {
                            idsWithHandshakeSent: prevState.idsWithHandshakeSent,
                            firstConnection: prevState.firstConnection,
                            selectAndLoadOpen: prevState.selectAndLoadOpen,
                            idsDisconnected: prevState.idsDisconnected,
                            rebooting: prevState.rebooting,
                            currentDeviceName: prevState.currentDeviceName,
                            inputSelected: prevState.inputSelected
                        }
                    }, () => resendCapture && this.sendCaptureRequestToBackend(true))
                } else {
                    output.close();
                    input.close();
                    this.setState((prevState) => {
                        if (!prevState.hiddenDevices.includes(inputIdx)) {
                            prevState.hiddenDevices = prevState.hiddenDevices.concat(inputIdx)
                        }
                        if (!prevState.idsWithHandshakeSent.includes(output.id)) {
                            prevState.idsWithHandshakeSent = prevState.idsWithHandshakeSent.concat(output.id)
                        }
                        return ({
                            hiddenDevices: prevState.hiddenDevices,
                            idsWithHandshakeSent: prevState.idsWithHandshakeSent
                        })
                    })
                }
            }


        }
    }

    updateInput(input_idx) {
        let deviceName = null;
        if (input_idx !== -1) {
            deviceName = this.state.inputs[input_idx];
        }
        _.forEach(this.state.inputsAccess, (input, idx) => {
            if (idx === input_idx) return false;
            input.close()
            if (this.state.outputsAccess.length > idx) {
                this.state.outputsAccess[idx].close()
            }
        })
        if (input_idx !== -1) {
            this.state.inputsAccess[input_idx].open()
            if (this.state.outputsAccess.length > input_idx) {
                this.state.outputsAccess[input_idx].open()
            }
        }
        let capturing = false;
        this.setState((prevState) => {
            capturing = prevState.capturing;
            return {
                inputSelected: input_idx,
                currentDeviceName: deviceName
            }
        }, () => capturing && this.sendCaptureRequestToBackend(true))
    }

    updateOutput(output_idx) {
        this.setState({ outputSelected: output_idx });
    }

    updateMidiMerge(index) {

        let new_value = (this.state.midiMergeOption[index] === 0) ? 1 : 0;

        this.setState((prevState) => {
            let newMidiMergeOption = prevState.midiMergeOption;
            newMidiMergeOption[index] = new_value;
            return (
                {
                    midiMergeOption: newMidiMergeOption,
                    hwconfig: { ...prevState.hwconfig, midiMergeOption: newMidiMergeOption }
                }
            )
        })
    }

    sysexStringIntoByteArray(encoded_sysex) {
        let sysex_utf8 = unescape(encodeURIComponent(encoded_sysex)); // mensaje sysex[bloque][seccion], la config inicial tiene una sola seccion
        //console.log('>> SYSEX UTF-8: ', sysex_utf8);

        let arr = [240]; // sysex start
        for (var i = 0; i < sysex_utf8.length; i++) {
            arr.push(sysex_utf8.charCodeAt(i));
        }

        arr.push(247); // sysex end

        return arr;
    }

    getOutputPort = () => {
        if (this.state.currentDeviceName === null) {
            this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                variant: "error"
            });
            return;
        }
        let outputPort = _.find(this.state.outputsAccess, (port) => {
            return port.name === this.state.currentDeviceName;
        })
        if (!outputPort) {
            this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                variant: "error"
            });
            return;
        }
        return outputPort;
    }


    findOutputForCurrentDevice() {
        return _.find(this.state.outputsAccess, (port) => {
            return port.name === this.state.currentDeviceName;
        })
    }

    async sendSysexToDevice(sysex, output) {
        let sysex_arr = this.sysexStringIntoByteArray(sysex);
        window.performance.mark('sysexSendStart')
        console.log('SYSEX_ARR', sysex_arr)
        if (!output) {
            if (this.state.currentDeviceName === null) {
                this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                    variant: "error"
                });
                return;
            }
            console.log('>> device name:', this.state.currentDeviceName)
            console.log('>> outputs access:', this.state.outputsAccess)

            let outputPort = this.findOutputForCurrentDevice()
            if (!outputPort) {
                this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                    variant: "error"
                });
                return;
            }
            await outputPort.send(sysex_arr)

        } else {
            if (false) {//(process.env.NODE_ENV === 'development') {
                let sysex_arr1 = [181, 99, 54]; // debug-tag
                let sysex_arr2 = [181, 98, 10];
                let sysex_arr3 = [181, 6, 21];
                let sysex_arr4 = [181, 38, 11];
                await output.send(sysex_arr1);
                await output.send(sysex_arr2);
                await output.send(sysex_arr3);
                await output.send(sysex_arr4);
            } else {
                await output.send(sysex_arr);
            }
        }

        console.log('>> SYSEX SENT:', sysex_arr, output)
    }

    async sendConfigToDevice(message, outputId, initial) {

        this.setState({ [outputId]: false })

        let blocks_sent = 0;
        let ack = false;
        let retries;
        for (let bank of message['sysex']) {
            for (let block of bank) {
                for (let section of block) {
                    retries = 0;
                    while (!ack && retries < MAX_ACK_RETRIES) {
                        retries += 1;
                        await this.sendSysexToDevice(section);
                        await sleep(10);
                        ack = await this.waitFor(2000, outputId, true);
                        this.setState({ [outputId]: false });
                    }

                    if (!ack) {
                        this.props.enqueueSnackbar(ERROR_NO_ACK_RECEIVED,
                            {
                                variant: "error"
                            })
                        return;
                    }
                    ack = false;
                    blocks_sent += 1
                }
            }
        }

        // Send Reboot message
        this.setState({ rebooting: true, outputId: false }, () => this.sendSysexToDevice(message['reboot-sysex']))

        await this.waitFor(2000, outputId, true)

        console.log('valid reboot?', this.state[outputId])
        this.setState({ [outputId]: false })

        console.log('blocks_sent: ', blocks_sent)
        window.performance.measure('sysexSends', 'sysexSendStart', 'sysexSendEnd')
        this.setState({ successfulConfig: true })

    }

    async handleSendToDevice() {

        // TODO: this block could be commented in dev mode to allow sending any ytx config dump
        if (this.state.currentDeviceName === null || this.state.inputSelected === -1) {
            this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                variant: "error"
            });
            return;
        }
        this.setState(() => {
            return { configuring: true }
        });
        let data = JSON.stringify(this.state.banks);
        let hwconfig = JSON.stringify(this.state.hwconfig);
        let hidsOutOfSync = this.state.partialUpdate ? this.state.outOfSyncInts : []
        try {
            if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
                this.setState({ configuring: false });
                this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                    variant: "error"
                })
                return;
            }

            let output = this.findOutputForCurrentDevice();
            // TODO: this block could be commented in dev mode to allow sending any ytx config dump
            if (!output) {
                this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                    variant: "error"
                });
                return;
            }
            // TODO: see how to set output_id and currentDeviceName in dev mode when allowing to send any ytx config dump
            this.backendWebSocket.send(JSON.stringify(
                { 'message': { 'hwconfig': hwconfig, 'config': data, 'command': 'set-config', 'subcommand': 'new', 'output_id': output.id, 'hidsOutOfSync': hidsOutOfSync, 'device_name': this.state.currentDeviceName } }
            ));
        } catch (error) {
            console.log('Could not send data to backend for encoding', error)
            //this.backendConnInterval = setInterval(this.connectToBackend, 100);
        }
    }

    validateConfig(config) {
        this.setState({ validating: true, loading: true });

        try {
            if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
                this.setState({ validating: false, loading: false });
                this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                    variant: "error"
                })
                return;
            }
            this.backendWebSocket.send(JSON.stringify({
                'message': { 'command': 'validate-config', 'config': config, 'hwconfig': this.state.hwconfig, 'device_name': this.state.currentDeviceName }
            }));
        } catch (error) {
            console.log('Could not send data to backend for validating config', error)
        }
    }

    onExitHardwareConfig(e) {
        this.setState({
            onHardwareConfig: false,
        });
    }

    onEnterHardwareConfig(e) {
        this.setState({
            onHardwareConfig: true,
        });
    }

    validateHwConfig = (configMapping) => {
        let usbPid = configMapping.usb_pid
        if (!Number.isInteger(usbPid)) {
            usbPid = parseInt(usbPid, 16);
        }
        console.log('usb pid', usbPid)
        let deviceName = configMapping.device_name;
        let deviceSerial = configMapping.usb_serial;
        let valid = true;

        if (isNaN(usbPid) || usbPid > USB_PID_MAX) {
            valid = false;
            this.props.enqueueSnackbar(ERROR_CONFIG_INVALID_PID,
                {
                    variant: "error"
                });
        } else {
            configMapping.usb_pid = usbPid;
        }

        if (!deviceName || deviceName.length > DEVICE_NAME_MAX_LENGTH) {
            valid = false;
            this.props.enqueueSnackbar(ERROR_CONFIG_DEVICE_NAME,
                {
                    variant: "error"
                })
        }

        if (!deviceSerial || deviceSerial.length > DEVICE_SERIAL_MAX_LENGTH) {
            valid = false;
            this.props.enqueueSnackbar(ERROR_CONFIG_USB_SERIAL,
                {
                    variant: "error"
                })
        }

        return valid;
    }

    onConfigHardwareMapping(e, configMapping) {
        if (this.state.currentDeviceName === null || this.state.inputSelected === -1) {
            this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                variant: "error"
            });
            return;
        }

        if (!this.validateHwConfig(configMapping)) {
            return;
        }

        this.setState(() => {
            return { configuring: true }
        });

        configMapping.midiMergeOption = this.state.midiMergeOption;
        configMapping.banksNumber = 1; // setting default config (only 1 bank)
        configMapping.banksModes = new Array(8).fill(this.TOGGLE);
        configMapping.banksIds = new Array(8).fill(0); // VALIDATE WITH YTX
        configMapping.takeover = this.state.takeover;
        configMapping.rainbow = this.state.rainbow;
        configMapping.remoteBanks = this.state.remoteBanks;
        configMapping.factoryReset = this.state.factoryReset;
        configMapping.dumpStateOnStartup = this.state.dumpStateOnStartup;
        configMapping.rememberState = this.state.rememberState;


        let data = JSON.stringify(configMapping);
        try {
            if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
                this.setState({ configuring: false });
                this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                    variant: "error"
                });
                return;
            }
            let output = this.findOutputForCurrentDevice();
            if (!output) {
                this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                    variant: "error"
                });
                return;
            }
            let res = this.backendWebSocket.send(JSON.stringify(
                { 'message': { 'config': data, 'command': 'set-config', 'subcommand': 'initial', 'output_id': output.id } }
            ));
        } catch (error) {
            console.log('Could not send initial hw mapping to backend', error);
            //this.backendConnInterval = setInterval(this.connectToBackend, 100)
        }
    }

    drawerToggleClickHandler = (e) => {
        let dId = e.currentTarget.id;
        this.setState((prevState) => {
            let open = prevState.drawerOpen ? dId !== prevState.drawerId : !prevState.drawerOpen;
            let drawerCls = open ? 'open' : '';
            return { drawerOpen: open, drawerId: dId, drawerClass: drawerCls };
        });
    };

    openConfigBox = () => {
        this.setState({
            drawerOpen: true,
            drawerId: 'config',
            drawerClass: 'open'
        })
    }

    handleChange(e) {
        this.setState({
            filter: e.target.value,
        });
    }

    handleShowChange(e) {
        e.target.classList.toggle('select-selected');
    }

    handleElementSelected(selectedIdxs, elemType, hardwareId, blink, firstSelection) {
        elemType = elemType + 's';
        if (firstSelection) {
            let idx = selectedIdxs.values().next().value;
            this.setState((prevState) => {
                var elem = { 'type': elemType, 'idx': idx, 'properties': prevState.banks[prevState.currentBank][elemType][idx], 'hid': hardwareId };
                return ({
                    currentElement: elem,
                    lastBlinkIdx: prevState.blinkIdx,
                    lastBlinkType: prevState.blinkType,
                    currentElementType: elemType,
                });
            });

            if (this.state.onCapture) {
                hardwareId = parseInt(hardwareId).toString();
                this.handleBankButtonSelect(hardwareId, this.state.bank_capture);
            }
        }

        this.setState((prevState) => {
            let currentElementTypeSelected = prevState.currentElementType + "Selected";
            let newElementTypeSelected = elemType + "Selected";

            if (elemType !== prevState.currentElementType || firstSelection) {
                prevState[currentElementTypeSelected] = new Set();
                prevState.currentElementType = elemType;
            }
            prevState[newElementTypeSelected] = new Set(selectedIdxs);

            return prevState;
        })
    }

    handleElementBlink = (blink, idx, elemType) => {
        if (blink) {
            console.log(elemType, idx)
            this.setState((prevState) => {
                if (!this.state.onCapture && (!prevState.drawerOpen || prevState.drawerId === 'banks')) {
                    prevState.drawerOpen = true;
                    prevState.drawerId = 'config';
                    prevState.drawerClass = 'open';
                }
                return ({
                    blinkIdx: idx,
                    blinkType: elemType,
                    drawerId: prevState.drawerId,
                    drawerClass: prevState.drawerClass,
                    drawerOpen: prevState.drawerOpen
                })
            })
        }
    }

    handlePropertyUpdate(e, option, key, prop, subProp, elemType) {
        this.setState((prevState) => {
            let currentBank = prevState.currentBank;
            let selectedIdxs = prevState[elemType + "Selected"];
            console.log(selectedIdxs);
            for (let [key, idx] of selectedIdxs.entries()) {
                console.log("idx:", idx)
                let hid = getHardwareId(elemType, prevState.banks[currentBank], idx);
                console.log("hid:", hid)
                let intHid = parseInt(hid) + (this.state.componentsCount * currentBank);
                prevState.banks[currentBank][elemType][idx][prop][subProp] = option;
                if (!prevState.outOfSync.includes(hid)) {
                    prevState.outOfSync.push(hid);
                }
                if (!prevState.outOfSyncInts.includes(intHid)) {
                    prevState.outOfSyncInts.push(intHid);
                }
            }

            return prevState;
        });
    }

    async handleBackendMessage(e) {

        let data = JSON.parse(e.data);
        let message = data['message'];
        let command = data['command'];
        let subcommand = data['subcommand'];
        let requestId = data['request_id'];
        let errors = data['errors'];
        let debugOutput = data['debug_output'];
        let outputId = data['output_id'];

        if (command !== 'ping') {
            console.log('message from backend: ', data);
        }
        if (debugOutput !== '') {
            console.log(debugOutput);
        }

        if (command === 'set-config') {
            if (subcommand === 'initial') {

                // TODO YGR is this partial state really necessary?
                this.setState(() => {
                    return {

                        banksNumber: Object.keys(message['config']['inputs']).length,
                        banks: message['config']['inputs'],
                        hwConfigDeviceName: message['config']['hwconfig']['device_name']

                    };
                });

                window.performance.mark('sendConfigToDeviceStart')
                if (this.state.midiAccess === null) {
                    this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                        variant: "error"
                    });
                    return;
                }

                /*if (! await this.initiateHandshakeWithDevice()) {
                    this.setState({configuring: false});
                    return;
                }*/

                await this.sendConfigToDevice(message, outputId, true);

                if (!this.state.successfulConfig) {
                    this.props.enqueueSnackbar(ERROR_FAILED_DEFAULT_CONFIG, {
                        variant: "error"
                    })
                    this.setState({ configuring: false });
                    return;
                }
                window.performance.mark('sendConfigToDeviceEnd')
                window.performance.measure('sendConfigToDevice', 'sendConfigToDeviceStart', 'sendConfigToDeviceEnd')
                console.log(window.performance.getEntriesByType('measure'))
                console.log('midiMergeOption', message['config']['hwconfig']['midiMergeOption'])
                let defaultBank = message['config']['default_bank']
                let componentsCount = Object.keys(defaultBank['encoders']).length + Object.keys(defaultBank['analogs']).length + Object.keys(defaultBank['digitals']).length
                console.log('>> COMPONENTS COUNT:', componentsCount)
                this.setState(() => {
                    let state = populateConfig(
                        message['config']['hwconfig'],
                        [],  // Initial = no bank button yet
                        {}, // Initial, no shifterIdBank
                        {}, // Initial, no shifterIdColor
                        message['config']['default_bank'],
                        componentsCount,
                        Object.keys(message['config']['inputs']).length,
                        message['config']['inputs'],
                        0
                    )
                    state.configuring = false;
                    state.successfulConfig = false;
                    state.outOfSync = [];
                    state.outOfSyncInts = [];
                    return state;
                })
            }

            else if (subcommand === 'new') {
                if (errors) {
                    this.setState({ configuring: false }, () =>
                        this.props.enqueueSnackbar(ERROR_FAILED_BUILDING_CONFIG + errors, {
                            variant: "error"
                        })
                    )
                    return;
                }
                window.performance.mark('sendConfigToDeviceStart')
                await this.sendConfigToDevice(message, outputId, false);

                if (!this.state.successfulConfig) {
                    this.props.enqueueSnackbar(ERROR_SENDING_CONFIG, {
                        variant: "error"
                    })
                    this.setState({ configuring: false });
                    return;
                }
                window.performance.mark('sendConfigToDeviceEnd')
                window.performance.measure('sendConfigToDevice', 'sendConfigToDeviceStart', 'sendConfigToDeviceEnd')
                console.log(window.performance.getEntriesByType('measure'))

                this.setState(() => {
                    return {
                        configuring: false,
                        onHardwareConfig: false,
                        successfulConfig: false,
                        outOfSync: [],
                        outOfSyncInts: [],
                        configLoaded: true,
                    }
                })
            }
        }

        else if (command === 'decode') {
            console.log('Decode message: ', message)
            if (message['error_message'] === '') {
                // no error, request was valid
                if (message['type'] === 'valid_request') {
                    this.setState({ [requestId]: true, sysexEchoMessage: message['debug'], [outputId]: true })
                }

                else if (message['type'] === 'handshake') {
                    this.setState({ [requestId]: true, handshakeSuccessful: true })
                }

                else if (message['type'] === 'capture') {
                    let { block, section, new_value } = message;
                    this.setState({ blinkIdx: -1, blinkType: '', lastBlinkIdx: -1, lastBlinkType: '' })
                    this.handleComponentCapture(block, section, new_value);
                }

                else if (message['type'] === 'config-block') {
                    let { bank, block, section, data, ackMessage } = message;
                    if (block === 'general') {
                        // GENERAL CONFIG
                        console.log('>> RECEIVED VALID BLOCK')
                        this.setState({
                            validBlockReceived: true,
                            invalidHWConfig: false,
                            generalConfig: data,
                            ackMessage: ackMessage
                        })
                    } else {
                        //console.log('>> Setting bank ', bank, ' block ', block, ' section ', section);
                        this.setNewSection(bank, block, section, data);
                    }
                }

                else if (message['type'] === 'fw-version') {
                    let { fw_version_major, fw_version_minor } = message;
                    let hwConfig = this.state.hwConfig;
                    hwConfig = _.merge(hwConfig, {fw_version_major: fw_version_major, fw_version_minor: fw_version_minor})
                    this.setState({ [requestId]: true, hwConfig: hwConfig })
                }

                else {
                    //console.log('Type of sysex received: ', message['type'])
                    //console.log('>> SYSEX DATA: ', message['debug'])
                    if (message['type'] === 'echo') {
                        this.setState({ sysexEchoMessage: message['debug'] })
                    }
                }
            }
            else if (message['invalid_hwconfig'] === true) {
                console.log('INVALID HWCONFIG')
                console.log('>> ERROR MESSAGE:', message['error_message'])
                console.log('>> DEBUG (received sysex):', message['debug'])
                this.setState({
                    sysexValidRequest: false,
                    validBlockReceived: true,
                    invalidHWConfig: true,
                })
            }
            else {
                console.log('SYSEX ERROR')
                console.log('>> MESSAGE TYPE: ', message['type'])
                console.log('>> STATUS:', message['status'])
                console.log('>> ERROR MESSAGE:', message['error_message'])
                console.log('>> DEBUG (received sysex):', message['debug'])
                this.setState({ sysexValidRequest: false })
            }

        }

        else if (command === 'special-requests') {

            if (errors) {
                this.props.enqueueSnackbar(ERROR_BACKEND_REQUEST_SPECIAL_COMMAND + subcommand + " | " + errors, {
                    variant: "error"
                })
                return;
            }
            if (subcommand === 'handshake') {
                this.setState({ [requestId]: true, handshakeCommand: message['handshake'], handshakeRequestReceived: true })
            }
            else if (subcommand === 'capture') {
                this.setState({ capturing: message['capture_on'] }, () => this.requestCaptureToDevice(message['capture-cmd'], message['capture_on']))
                this.props.enqueueSnackbar(INFO_CAPTURE_TOGGLE, {
                    variant: "info"
                })
            }
            else if (subcommand === 'reset') {
                this.setState({ [requestId]: true, resetCommand: message['reset-cmd'] })
            }
            else if (subcommand === 'firmware_version') {
                this.setState({ [requestId]: true, fwVersionCommand: message['fw-version-cmd'] })
            }
        }

        else if (command === 'save-config') {

            if (errors) {
                this.setState({ saving: false })
                this.props.enqueueSnackbar(ERROR_BACKEND_SAVING_CONFIG, {
                    variant: 'error',
                })
                return;
            }

            let onlyAccount = message['only-to-account'];
            if (onlyAccount) {
                this.setState({ saving: false })
                this.props.enqueueSnackbar(SUCCESS_CONFIG_UPLOADED, {
                    variant: 'success'
                })
                return;
            }
            this.props.enqueueSnackbar(SUCCESS_CONFIG_READY_TO_DOWNLOAD, {
                variant: 'success'
            })
            const configBlog = prepareJsonBlob(message['config'])
            downloadBlob(configBlog, message['filename'])
            this.setState({ saving: false })
        }

        else if (command === 'get-block') {
            if (errors) {
                this.setState({ loading: false })
                this.props.enqueueSnackbar(ERROR_BACKEND_REQUESTING_BLOCK_COMMAND + errors, {
                    variant: "error"
                })
                return;
            }
            let getCommand = message['get_command'];
            this.sendSysexToDevice(getCommand);
        }

        else if (command === 'get-config') {

            if (errors) {
                this.setState({ loading: false })
                this.props.enqueueSnackbar(ERROR_BACKEND_REQUESTING_GET_CONFIG_COMMANDS + errors, {
                    variant: "error"
                })
                return;
            }
            if (subcommand === 'account') {
                // NOT IMPLEMENTED!!!
                let config = message['config'];
                let banksNumber = Object.keys(config['banks']).length;
                let bankButtonsInUse = _.map(_.filter(config['banks'], (value) => { return value['button'] !== "None" }), (value) => { return (parseInt(value['button'])) })
                let shifterIdBank = {};
                let shifterIdColor = {}
                _.forEach(config['banks'], (value, bankNum) => {
                    let button = value['button'];
                    if (button !== 'None') {
                        button = parseInt(button);
                        shifterIdBank[button] = parseInt(bankNum);
                        shifterIdColor[button] = (value['color'] === 'None') ? DEFAULT_BANK_COLOR : value['color'];
                    }
                })
                console.log('>> ids in use', bankButtonsInUse)
                console.log('>> midi merge options:', config['hwconfig']['midiMergeOption'])
                console.log('>> shifter id bank:', shifterIdBank)
                console.log('>> shifter id color:', shifterIdColor)
                let defaultBank = message['default_bank']
                let componentsCount = Object.keys(defaultBank['encoders']).length + Object.keys(defaultBank['analogs']).length + Object.keys(defaultBank['digitals']).length
                console.log('>> COMPONENTS COUNT:', componentsCount)
                this.setState(
                    populateConfig(
                        config['hwconfig'],
                        bankButtonsInUse,
                        shifterIdBank,
                        shifterIdColor,
                        message['default_bank'],
                        componentsCount,
                        banksNumber,
                        config['banks'],
                        0
                    ), () => {
                        this.props.enqueueSnackbar(SUCCESS_CONFIG_LOADED, {
                            variant: "success"
                        });
                        warnIfOldFirmware(config['hwconfig'], this.props.enqueueSnackbar, this.props.closeSnackbar);
                    }
                    );

            } else if (subcommand === 'ctrl') {
                if (!message['valid_config']) {
                    this.props.enqueueSnackbar(INFO_OPENING_HW_CONFIG, {
                        variant: "info"
                    })
                    this.setState({ onHardwareConfig: true })
                } else {
                    let getCmds = message['get-cmds-array'];
                    let controllerLayout = message['controller-layout']
                    this.setState(
                        {
                            loading: true,
                            configLoaded: false,
                            banks: {},
                            analogsWithFeedback: controllerLayout['analogsWithFeedback'],
                            defaultBank: _.cloneDeep(message['default_bank']),
                            expectedSections: getCmds.length
                        }, async () => await this.getCompleteConfigFromController(controllerLayout, getCmds)
                    )
                }
            } else if (subcommand === 'default') {
                let config = message['config'];
                let banksNumber = Object.keys(config['banks']).length;
                let bankButtonsInUse = _.map(_.filter(config['banks'], (value) => { return value['button'] !== "None" }), (value) => { return (parseInt(value['button'])) })
                let shifterIdBank = {};
                let shifterIdColor = {}
                _.forEach(config['banks'], (value, bankNum) => {
                    let button = value['button'];
                    if (button !== 'None') {
                        button = parseInt(button);
                        shifterIdBank[button] = parseInt(bankNum);
                        shifterIdColor[button] = (value['color'] === 'None') ? DEFAULT_BANK_COLOR : value['color'];
                    }
                })
                let defaultBank = message['default_bank']
                let componentsCount = Object.keys(defaultBank['encoders']).length + Object.keys(defaultBank['analogs']).length + Object.keys(defaultBank['digitals']).length
                console.log('>> COMPONENTS COUNT:', componentsCount)

                // YGR: Overwrite the firmware version from default config with the one we got earlier from the controller itself
                console.log(`Overriding fw version from default config (${config['hwconfig']['fw_version_minor']}) with the one from controller (${this.state.hwConfig.fw_version_minor})`)
                config['hwconfig']['fw_version_major'] = this.state.hwConfig.fw_version_major
                config['hwconfig']['fw_version_minor'] = this.state.hwConfig.fw_version_minor

                this.setState(
                    populateConfig(
                        config['hwconfig'],
                        bankButtonsInUse,
                        shifterIdBank,
                        shifterIdColor,
                        message['default_bank'],
                        componentsCount,
                        banksNumber,
                        config['banks'],
                        0
                    ), () => {
                        this.props.enqueueSnackbar(SUCCESS_CONFIG_LOADED, {
                            variant: "success"
                        });
                        warnIfOldFirmware(config['hwconfig'], this.props.enqueueSnackbar, this.props.closeSnackbar);
                    }
                    );
            }
        } else if (command === 'validate-config') {
            // Called when loading from .ytx file
            if (errors) {
                this.setState({
                    validating: false,
                    loading: false
                }, () => this.props.enqueueSnackbar(ERROR_CONFIG_INVALID + errors, {
                    variant: "error"
                }))
                return;
            }
            let config = JSON.parse(message['config']);
            let bankButtonsInUse = _.map(_.filter(config['banks'], (value) => { return value['button'] !== "None" }), (value) => { return (parseInt(value['button'])) })
            let shifterIdBank = {};
            let shifterIdColor = {}
            _.forEach(config['banks'], (value, bankNum) => {
                let button = value['button'];
                if (button !== 'None') {
                    button = parseInt(button);
                    shifterIdBank[button] = parseInt(bankNum);
                    shifterIdColor[button] = (value['color'] === 'None') ? DEFAULT_BANK_COLOR : value['color'];
                }
            })
            let defaultBank = message['default_bank']
            let componentsCount = Object.keys(defaultBank['encoders']).length + Object.keys(defaultBank['analogs']).length + Object.keys(defaultBank['digitals']).length
            console.log('>> COMPONENTS COUNT:', componentsCount)


            if (this.state.inputSelected !== -1 && this.findOutputForCurrentDevice()) {
                await this.requestFwVersion();

                // YGR: Overwrite the firmware version from file config with the one we got earlier from the controller itself
                console.log(`Overriding fw version from file config (${config['hwconfig']['fw_version_minor']}) with the one from controller (${this.state.hwConfig.fw_version_minor})`)
                config['hwconfig']['fw_version_major'] = this.state.hwConfig.fw_version_major
                config['hwconfig']['fw_version_minor'] = this.state.hwConfig.fw_version_minor
            }

            this.setState((prevState) => {

                let currentElement = prevState.currentElement;
                if (currentElement['type'] !== null) {
                    currentElement['properties'] = config['banks'][prevState.currentBank][currentElement['type']][currentElement['idx']];
                }

                let banksNumber = Object.keys(config['banks']).length;
                let newConfig = populateConfig(
                    config['hwconfig'],
                    bankButtonsInUse,
                    shifterIdBank,
                    shifterIdColor,
                    message['default_bank'],
                    componentsCount,
                    banksNumber,
                    config['banks'],        // HERE IS ALL THE MEANINGFUL DATA!! haha
                    prevState.currentBank
                );
                newConfig['onHardwareConfig'] = false;
                newConfig['currentElement'] = currentElement;
                newConfig['validating'] = false;
                newConfig['outOfSync'] = [];
                newConfig['outOfSyncInts'] = [];

                return newConfig;
            }, () => {
                    this.props.enqueueSnackbar(SUCCESS_CONFIG_LOADED, {
                        variant: "success"
                    });
                    warnIfOldFirmware(config['hwconfig'], this.props.enqueueSnackbar, this.props.closeSnackbar);
            })
        }
    }

    handleBackendClose(e) {
        //console.log('Backend WebSocket closed unexpectedly');
        if (!this.state.reconnecting) {
            this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: 'error'
            })
        }
        this.setState(() => {
            return { configuring: false }
        });
        console.log('>> CONECTION WITH BACKEND DOWN')
        this.backendConnInterval = setInterval(this.connectToBackend, 3000)

        //this.backendWebSocket = new WebSocket(this.ws_scheme + '://' + BACKEND_URL +'/ws/kilowhat/ytxuser/');
    }

    handleBackendError(e) {
        console.log('Backend Websocket error:', e)
        //alert('Connection with Server closed, reconnecting... Please try again later!')
        this.setState(() => {
            return { configuring: false }
        });
        clearInterval(this.backendConnInterval);
        clearInterval(this.backendPingInterval);
        if (this.backendWebSocket.readyState !== this.backendWebSocket.CLOSED) {
            console.log('>> Closing connection with Backend')
            this.backendWebSocket.close();
        }
        //this.backendConnInterval = setInterval(this.connectToBackend, 3000)
    }

    handleBackendOpen() {
        this.backendWebSocket.onmessage = this.handleBackendMessage.bind(this);
        this.setState({ reconnecting: false })
        this.props.enqueueSnackbar(SUCCESS_BACKEND_CONN_UP, {
            variant: "success"
        });
        clearInterval(this.backendConnInterval);
        this.backendPingInterval = setInterval(this.sendPingToBackend, 10000);
    }

    connectToBackend() {
        this.setState({ reconnecting: true })
        this.backendWebSocket = new WebSocket(this.ws_scheme + '://' + BACKEND_URL + '/ws/kilowhat/ytxuser/');
        this.backendWebSocket.onopen = this.handleBackendOpen.bind(this);
        this.backendWebSocket.onclose = this.handleBackendClose.bind(this);
        this.backendWebSocket.onerror = this.handleBackendError.bind(this);

    }

    sendPingToBackend() {
        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            return;
        }
        try {
            this.backendWebSocket.send(JSON.stringify(
                { 'message': { 'command': 'ping' } }
            ));
        } catch (error) {
            console.log('Could not send ping to backend', error)
        }
    }

    getBankButtonOptions() {
        let options = [
            { 'category': 'button', 'value': 'None' },
            { 'category': 'divider', 'value': '' },
            { 'category': 'capture', 'value': 'Capture' },
            { 'category': 'divider', 'value': '' },
            { 'category': 'buttonType', 'value': 'Enc. Switch' },
        ];

        let encoderNum = Object.keys(this.state.banks[0].encoders).length;

        for (let i = 0; i < encoderNum; i++) {
            if (!this.state.bankButtonsInUse.includes(i)) {
                options.push({ 'category': 'button', 'value': (i).toString() })
            }
        }

        options.push({ 'category': 'divider', 'value': '' });
        options.push({ 'category': 'buttonType', 'value': 'Digitals' });

        for (let i = encoderNum; i < encoderNum + Object.keys(this.state.banks[0].digitals).length; i++) {
            if (!this.state.bankButtonsInUse.includes(i)) {
                options.push({ 'category': 'button', 'value': (i).toString() })
            }
        }

        return options;
    }

    handleBankButtonSelect(option, bank_num) {

        // Check if we were on capture mode and disable it
        if (this.state.onCapture) {
            let optionId = parseInt(option);
            if (this.state.bankButtonsInUse.includes(optionId)) {
                let bankWithButton = Object.keys(this.state.banksButtonsId).findIndex((bank) => this.state.banksButtonsId[bank] === optionId);
                this.props.enqueueSnackbar(optionId + ' id is already in use by bank ' + (bankWithButton + 1) + '. Please select another one.', {
                    variant: 'info'
                })
                return;
            }

            this.setState({ onCapture: false, bank_capture: null });
        }

        if (option === 'Capture') {
            this.setState({ onCapture: true, bank_capture: bank_num }, () => this.props.enqueueSnackbar(INFO_BANK_CAPTURE_ON, {
                variant: 'info'
            }));
            return;
        }

        // If we are setting again a bank button to None, do nothing
        let prevButton = this.state.banks[bank_num].button;
        if (prevButton === 'None' && option === 'None') {
            return;
        }

        let encoderNum = Object.keys(this.state.banks[0].encoders).length;
        let prevButtonId = parseInt(prevButton);
        let newBankButtonsInUse = this.state.bankButtonsInUse;

        // Enable previous bank button to be configured and remove it from bank buttons in use
        if (prevButton !== "None") {
            if (prevButtonId < encoderNum) {
                this.allowEncoderSwitchConfig(prevButtonId.toString());
            }
            else {
                console.log(prevButtonId - encoderNum)
                this.allowDigitalConfig((prevButtonId - encoderNum).toString());
            }
            newBankButtonsInUse = newBankButtonsInUse.filter((value) => { return value !== prevButtonId });
        }

        // set new bank button id and disable config from corresponding component in every bank
        let newButtonId = "None";
        if (option !== "None") {
            newButtonId = parseInt(option);
            newButtonId < encoderNum ? this.assignBankToEncoderSwitch(newButtonId.toString()) : this.assignBankToDigital((newButtonId - encoderNum).toString(), bank_num + 1);
            newBankButtonsInUse = newBankButtonsInUse.concat(newButtonId);
        }

        this.setState((prevState) => {
            let changingShifterId = false;
            let newShifterSet = newButtonId !== "None";
            let prevShifterIdx;
            let newShifterIdx = (newButtonId < encoderNum) ? newButtonId : newButtonId - encoderNum;
            if (prevButton !== 'None') {
                changingShifterId = true;
                delete prevState.shifterIdColor[prevButtonId];
                delete prevState.shifterIdBank[prevButtonId];
                prevShifterIdx = (prevButtonId < encoderNum) ? prevButtonId : prevButtonId - encoderNum;
            }
            if (changingShifterId || newShifterSet) {
                _.forEach(prevState.banks, (bank) => {
                    if (changingShifterId) {
                        if (prevButtonId < encoderNum) {
                            let color = (bank.color === 'None') ? DEFAULT_SWITCH_COLOR : bank.color;
                            bank.encoders[prevShifterIdx].switch_feedback.color = color;
                        } else {
                            let color = (bank.color === 'None') ? DEFAULT_DIGITAL_COLOR : bank.color;
                            bank.digitals[prevShifterIdx].feedback_config.color = color;
                        }
                    }
                    if (newShifterSet) {
                        if (newButtonId < encoderNum) {
                            let color = (prevState.banks[bank_num].color === 'None') ?
                                prevState.banks[bank_num].encoders[newShifterIdx].switch_feedback.color :
                                prevState.banks[bank_num].color;
                            bank.encoders[newShifterIdx].switch_feedback.color = color;
                        } else {
                            let color = (prevState.banks[bank_num].color === 'None') ?
                                prevState.banks[bank_num].digitals[newShifterIdx].feedback_config.color :
                                prevState.banks[bank_num].color;
                            bank.digitals[newShifterIdx].feedback_config.color = color;
                        }
                    }
                })
            }
            if (newButtonId !== 'None') {
                prevState.shifterIdBank[newButtonId] = bank_num + 1;
                let shifterColor;
                if (newButtonId < encoderNum) {
                    shifterColor = prevState.banks[bank_num].color === 'None' ?
                        prevState.banks[bank_num].encoders[newButtonId].switch_feedback.color :
                        prevState.banks[bank_num].color;
                } else {
                    shifterColor = prevState.banks[bank_num].color === 'None' ?
                        prevState.banks[bank_num].digitals[newButtonId - encoderNum].feedback_config.color :
                        prevState.banks[bank_num].color;
                }
                prevState.shifterIdColor[newButtonId] = shifterColor;
            }
            return ({
                banks: { ...prevState.banks, [bank_num]: { ...prevState.banks[bank_num], "button": option } },
                shifterIdBank: prevState.shifterIdBank,
                shifterIdColor: prevState.shifterIdColor,
                bankButtonsInUse: newBankButtonsInUse,
                banksButtonsId: { ...prevState.banksButtonsId, [bank_num]: newButtonId === "None" ? 0xFFFF : newButtonId },
                hwconfig: { ...prevState.hwconfig, banksIds: { ...prevState.hwconfig.banksIds, [bank_num]: newButtonId === "None" ? 0xFFFF : newButtonId } },
            });
        });
    }

    assignBankToEncoderSwitch(buttonId) {
        _.forEach(this.state.banks, (bank) => {
            bank.encoders[buttonId].switch_config.disabled = true;
            bank.encoders[buttonId].switch_feedback.disabled = true;
        })
    }

    allowEncoderSwitchConfig(buttonId) {
        _.forEach(this.state.banks, (bank) => {
            bank.encoders[buttonId].switch_config.disabled = false;
            bank.encoders[buttonId].switch_feedback.disabled = false;
        })
    }

    allowDigitalConfig(buttonId) {
        _.forEach(this.state.banks, (bank) => {
            bank.digitals[buttonId].disabled = false;
        })
    }

    assignBankToDigital(buttonId, bank_num) {
        _.forEach(this.state.banks, (bank) => {
            bank.digitals[buttonId].disabled = true;
            bank.digitals[buttonId].bank_num = bank_num;
        })
    }

    handleBankModeSelect(option, key, bank_num) {

        this.setState((prevState) => {
            console.log(option, key, bank_num)
            return ({
                banks: { ...prevState.banks, [bank_num]: { ...prevState.banks[bank_num], "mode": option } },
                banksModes: { ...prevState.banksModes, [bank_num]: key },
                hwconfig: { ...prevState.hwconfig, banksModes: { ...prevState.hwconfig.banksModes, [bank_num]: key } }
            });
        });

        if (key === 0) {
            return;
        }

        let bank = this.state.banks[bank_num]
        let encoders = bank.encoders;
        let digitals = bank.digitals;

        _.forEach(encoders, (encoder) => {
            encoder.switch_config.mode = key - 1;
        });
        _.forEach(digitals, (digital) => {
            digital.action_config.toggle_momentary = key - 1;
        });

    }

    handleBankMidiChSelect(option, key, bank_num) {

        this.setState((prevState) => {
            return ({ banks: { ...prevState.banks, [bank_num]: { ...prevState.banks[bank_num], "midi_ch": option } } });
        });

        if (key === 0) {
            return;
        }

        let bank = this.state.banks[bank_num]
        let encoders = bank.encoders;
        let digitals = bank.digitals;
        let analogs = bank.analogs;
        let feedbacks = bank.feedbacks;

        _.forEach(encoders, (encoder) => {
            encoder.rotary_config.channel = key - 1;
            encoder.switch_config.channel = key - 1;
            encoder.rotation_feedback.channel = key - 1;
            encoder.switch_feedback.channel = key - 1;
        });
        _.forEach(digitals, (digital) => {
            digital.action_config.channel = key - 1;
            digital.feedback_config.channel = key - 1;
        });
        _.forEach(analogs, (analog) => {
            analog.message_config.channel = key - 1;
            analog.feedback_config.channel = key - 1;
        });
        _.forEach(feedbacks, (feedback) => {
            feedback.feedback_config.channel = key - 1;
        });

    }

    setShiftersBankParams = (bank) => {
        let bankId = bank.button;
        if (bankId !== 'None') {
            bankId = parseInt(bankId);
        }

        let banksButtonsId = this.state.bankButtonsInUse;
        let encoderNum = Object.keys(this.state.banks[0].encoders).length;

        _.forEach(banksButtonsId, (shifterId) => {
            if (shifterId === bankId) {
                return false;
            }
            let idx = (shifterId < encoderNum) ? shifterId : shifterId - encoderNum;
            let color = this.state.shifterIdColor[shifterId];
            let component;
            if (shifterId < encoderNum) {
                component = bank.encoders[idx];
                component.switch_feedback.color_range_enable = COLOR_RANGE_OFF;
                component.switch_feedback.color = color;
                component.switch_feedback.disabled = true;
                component.switch_config.disabled = true;
            } else {
                component = bank.digitals[idx];
                component.feedback_config.color_range_enable = COLOR_RANGE_OFF;
                component.feedback_config.color = color;
                component.disabled = true;
                component.bank_num = this.state.shifterIdBank[shifterId];
            }
        })
    }

    handleBankColorSelect = (color, bank_num) => {
        let encoderNum = Object.keys(this.state.banks[0].encoders).length;
        let banksIdsInUse = this.state.bankButtonsInUse;
        this.setState((prevState) => {
            let i = 0;
            let bank = prevState.banks[bank_num];
            let buttonId = bank.button;
            if (buttonId !== 'None') {
                buttonId = parseInt(buttonId);
            }
            _.forEach(bank.encoders, (encoder) => {
                let hid = i.toString().padStart(2, '0');
                encoder.rotation_feedback.color = color;
                if (i === buttonId || !banksIdsInUse.includes(i)) {
                    prevState.shifterIdColor[buttonId] = color;
                    encoder.switch_feedback.color_range_enable = COLOR_RANGE_OFF;
                    encoder.switch_feedback.color = color;
                }
                let hidInt = parseInt(hid) + (this.state.componentsCount * bank_num)
                if (!prevState.outOfSync.includes(hid)) {
                    prevState.outOfSync.push(hid);
                }
                if (!prevState.outOfSyncInts.includes(hidInt)) {
                    prevState.outOfSyncInts.push(hidInt);
                }
                i += 1;
            })
            _.forEach(bank.digitals, (digital) => {
                let hid = i.toString().padStart(2, '0');
                if (i === buttonId || !banksIdsInUse.includes(i)) {
                    prevState.shifterIdColor[buttonId] = color;
                    digital.feedback_config.color_range_enable = COLOR_RANGE_OFF;
                    digital.feedback_config.color = color;
                }
                let hidInt = parseInt(hid) + (this.state.componentsCount * bank_num);
                if (!prevState.outOfSync.includes(hid)) {
                    prevState.outOfSync.push(hid);
                }
                if (!prevState.outOfSyncInts.includes(hidInt)) {
                    prevState.outOfSyncInts.push(hidInt);
                }
                i += 1;
            })
            _.forEach(bank.analogs, (analog) => {
                let hid = i.toString().padStart(2, '0');
                i += 1;
                analog.feedback_config.color_range_enable = COLOR_RANGE_OFF;
                analog.feedback_config.color = color;
                let hidInt = parseInt(hid) + (this.state.componentsCount * bank_num);
                if (!prevState.outOfSync.includes(hid)) {
                    prevState.outOfSync.push(hid);
                }
                if (!prevState.outOfSyncInts.includes(hidInt)) {
                    prevState.outOfSyncInts.push(hidInt);
                }
            })

            bank.color = color;
            if (bank.button !== 'None') {
                // set shifter id color in all banks
                let buttonId = parseInt(bank.button);
                _.forEach(prevState.banks, (ibank, num) => {
                    console.log(ibank, num);
                    if (num === bank_num) return;
                    let component;
                    let hid = buttonId.toString().padStart(2, '0');
                    let hidInt = buttonId + (this.state.componentsCount * num);
                    if (!prevState.outOfSync.includes(hid)) {
                        prevState.outOfSync.push(hid);
                    }
                    if (!prevState.outOfSyncInts.includes(hidInt)) {
                        prevState.outOfSyncInts.push(hidInt);
                    }
                    if (buttonId < encoderNum) {
                        component = ibank.encoders[buttonId];
                        //component.rotation_feedback.color = color; // should rotary color be set as well?
                        component.switch_feedback.color_range_enable = COLOR_RANGE_OFF;
                        component.switch_feedback.color = color;
                    } else {
                        component = ibank.digitals[buttonId - encoderNum];
                        component.feedback_config.color_range_enable = COLOR_RANGE_OFF;
                        component.feedback_config.color = color;
                    }


                })
            }

            return prevState;
        })
    }

    handleAddBank() {
        this.setState((prevState) => {
            let banks_num = Object.keys(prevState.banks).length;
            let newBank = _.cloneDeep(prevState.defaultBank);
            let encodersCount = Object.keys(this.state.banks[0].encoders).length;
            let digitalsCount = Object.keys(this.state.banks[0].digitals).length;
            let componentsCount = this.state.componentsCount;
            let bankButtonsInUse = this.state.bankButtonsInUse;
            let shifterIdColor = this.state.shifterIdColor;
            let outOfSync = prevState.outOfSync;
            let outOfSyncInts = prevState.outOfSyncInts;

            for (var i = 0; i < componentsCount; i++) {
                let hid = toString().padStart(2, '0');
                let hidInt = i + (componentsCount * banks_num);
                if (!outOfSync.includes(hid)) {
                    outOfSync.push(hid);
                }
                if (!outOfSyncInts.includes(hidInt)) {
                    outOfSyncInts.push(hidInt);
                }
            }

            newBank['feedbacks'] = {};
            let newButton = this.getNextShifterIdAvailable();
            newBank['button'] = newButton !== "None" ? newButton.toString() : newButton;
            if (newButton !== "None") {
                bankButtonsInUse.push(newButton);
                if (newButton < encodersCount) {
                    this.assignBankToEncoderSwitch(newButton);
                    shifterIdColor[newButton] = DEFAULT_SWITCH_COLOR;
                    newBank.encoders[newButton].switch_config.disabled = true
                    newBank.encoders[newButton].switch_feedback.disabled = true;
                } else if (newButton < (encodersCount + digitalsCount)) {
                    let digitalIdx = newButton - encodersCount;
                    shifterIdColor[newButton] = DEFAULT_DIGITAL_COLOR;
                    this.assignBankToDigital(digitalIdx, banks_num + 1);
                    newBank.digitals[digitalIdx].disabled = true
                    newBank.digitals[digitalIdx].bank_num = banks_num + 1;
                }
            }
            // set other shifter ids feedback color in new bank and disabled their config
            this.setShiftersBankParams(newBank);
            console.log(newBank)
            let newBankId = newButton === 'None' ? 0xFFFF : newButton;
            return ({
                banks: { ...prevState.banks, [banks_num]: newBank },
                banksNumber: banks_num + 1,
                bankButtonsInUse: bankButtonsInUse,
                shifterIdColor: shifterIdColor,
                hwconfig: { ...prevState.hwconfig, banksNumber: banks_num + 1, banksIds: { ...prevState.hwconfig.banksIds, [banks_num]: newBankId } }
            });
        });
    }

    handleBankSelect(bank_num) {
        let elem = this.state.currentElement;
        if (elem.properties !== null) {
            elem.properties = this.state.banks[parseInt(bank_num)][elem.type][elem.idx];
        }
        this.setState({
            currentBank: parseInt(bank_num),
            currentElement: elem
        });
    }

    handleBankDelete(bank_num) {

        const newBanks = {}
        let newBankIds = new Array(8).fill(0xFFFF);
        let newBankModes = new Array(8).fill(this.TOGGLE);
        bank_num = bank_num - 1;
        let buttonId = this.state.banks[bank_num].button;
        let encoderNum = Object.keys(this.state.banks[0].encoders).length;
        if (buttonId !== 'None') {
            buttonId = parseInt(buttonId);
        }

        _.forEach(this.state.banks, (bank, num) => {
            if (num !== bank_num) {
                if (buttonId !== 'None' && buttonId < encoderNum) {
                    let color = (bank.color === 'None') ? DEFAULT_SWITCH_COLOR : bank.color;
                    bank.encoders[buttonId].switch_config.disabled = false;
                    bank.encoders[buttonId].switch_feedback.disabled = false;
                    bank.encoders[buttonId].switch_feedback.color = color;
                } else if (buttonId !== 'None') {
                    let color = (bank.color === 'None') ? DEFAULT_DIGITAL_COLOR : bank.color;
                    bank.digitals[buttonId - encoderNum].disabled = false;
                    bank.digitals[buttonId - encoderNum].feedback_config.color = color;
                }
            }
            if (num < bank_num) {
                newBankIds[num] = bank.button === "None" ? 0xFFFF : parseInt(bank.button);
                newBankModes[num] = bank.mode === "Momentary" ? this.MOMENTARY : this.TOGGLE;
                newBanks[num] = _.cloneDeep(bank);
            }
            else if (num > bank_num) {
                newBankIds[num - 1] = bank.button === "None" ? 0xFFFF : parseInt(bank.button);
                newBankModes[num - 1] = bank.mode === "Momentary" ? this.MOMENTARY : this.TOGGLE;
                newBanks[num - 1] = _.cloneDeep(bank);
            }
        })

        let banksNumber = Object.keys(newBanks).length;

        this.setState((prevState) => {
            console.log(prevState.currentBank)
            console.log(bank_num)
            if (buttonId !== "None") {
                prevState.bankButtonsInUse = _.filter(prevState.bankButtonsInUse, (button) => {
                    return button !== buttonId;
                })
                prevState.shifterIdBank = _.filter(prevState.shifterIdBank, (shifterId) => {
                    return shifterId !== buttonId
                })
                prevState.shifterIdColor = _.filter(prevState.shifterIdColor, (shifterId) => {
                    return shifterId !== buttonId
                })
            }
            if (bank_num === prevState.currentBank) {
                prevState.currentBank = 0;
            }
            return ({
                banks: newBanks,
                banksNumber: banksNumber,
                currentBank: prevState.currentBank,
                banksButtonsId: newBankIds,
                banksModes: newBankModes,
                bankButtonsInUse: prevState.bankButtonsInUse,
                shifterIdBank: prevState.shifterIdBank,
                shifterIdColor: prevState.shifterIdColor,
                hwconfig: { ...prevState.hwconfig, banksNumber: banksNumber, banksModes: newBankModes, banksIds: newBankIds }
            })
        })
    }

    handleBankDuplicate(bank_num) {

        bank_num = bank_num - 1;

        let banks_num = Object.keys(this.state.banks).length;
        let newBank = _.cloneDeep(this.state.banks[bank_num]);
        let bankButtonsInUse = this.state.bankButtonsInUse;
        let banksButtonsId = this.state.banksButtonsId;
        let banksModes = this.state.banksModes;
        let shifterIdColor = this.state.shifterIdColor;
        let shifterIdBank = this.state.shifterIdBank;
        let encodersNum = Object.keys(this.state.banks[0].encoders).length;

        newBank.button = this.getNextShifterIdAvailable();
        if (newBank.button !== "None") {
            let buttonId = parseInt(newBank.button);
            let component = buttonId < encodersNum ? "encoder" : "digital";
            let shifterIdx = component === "encoder" ? buttonId : buttonId - encodersNum;
            if (component === "encoder") {
                this.assignBankToEncoderSwitch(shifterIdx);
                newBank.encoders[shifterIdx].switch_config.disabled = true;
                newBank.encoders[shifterIdx].switch_feedback.disabled = true;
            } else {
                this.assignBankToDigital(shifterIdx, banks_num + 1);
                newBank.digitals[shifterIdx].disabled = true
                newBank.digitals[shifterIdx].bank_num = banks_num + 1;
            }
            bankButtonsInUse.push(buttonId);
            banksButtonsId[banks_num] = buttonId;
            banksModes[banks_num] = newBank.mode === "Momentary" ? this.MOMENTARY : this.TOGGLE;
            let defaultColor = buttonId < encodersNum ? DEFAULT_SWITCH_COLOR : DEFAULT_DIGITAL_COLOR;
            shifterIdColor[buttonId] = newBank.color === "None" ? defaultColor : newBank.color;
            shifterIdBank[buttonId] = banks_num;
        }

        this.setState((prevState) => {
            if (newBank.button !== "None" && newBank.color !== "None") {
                let buttonId = parseInt(newBank.button);
                _.forEach(prevState.banks, (bank) => {
                    let shifterIdx = buttonId < encodersNum ? buttonId : buttonId - encodersNum;
                    if (buttonId < encodersNum) {
                        bank.encoders[shifterIdx].switch_config.disabled = true;
                        bank.encoders[shifterIdx].switch_feedback.disabled = true;
                        bank.encoders[shifterIdx].switch_feedback.color_range_enable = COLOR_RANGE_OFF;
                        bank.encoders[shifterIdx].switch_feedback.color = newBank.color;
                    } else {
                        bank.digitals[shifterIdx].disabled = true;
                        bank.digitals[shifterIdx].bank_num = banks_num + 1;
                        bank.digitals[shifterIdx].feedback_config.color_range_enable = COLOR_RANGE_OFF;
                        bank.digitals[shifterIdx].feedback_config.color = newBank.color;
                    }
                })
            }

            return ({
                banks: { ...prevState.banks, [banks_num]: newBank },
                banksNumber: banks_num + 1,
                banksModes: banksModes,
                banksButtonsId: banksButtonsId,
                bankButtonsInUse: bankButtonsInUse,
                shifterIdBank: shifterIdBank,
                shifterIdColor: shifterIdColor,
                hwconfig: { ...prevState.hwconfig, banksNumber: banks_num + 1, banksModes: banksModes, banksIds: banksButtonsId }
            });
        })
    }

    handlePassDataToBank(source_bank, target_bank) {
        let button = this.state.banks[target_bank].button;
        let newBank = _.cloneDeep(this.state.banks[source_bank]);
        let shifterIdColor = this.state.shifterIdColor;
        let banksModes = this.state.banksModes;

        banksModes[target_bank] = newBank.mode === "Momentary" ? this.MOMENTARY : this.TOGGLE;

        newBank.button = button;
        if (button !== "None") {
            let shifterId = parseInt(button);
            let defaultColor = shifterId < Object.keys(this.state.banks[0].encoders).length ? DEFAULT_SWITCH_COLOR : DEFAULT_DIGITAL_COLOR;
            shifterIdColor[shifterId] = newBank.color === "None" ? defaultColor : newBank.color;
        }

        this.setState((prevState) => {
            return ({
                banks: { ...prevState.banks, [target_bank]: newBank },
                banksModes: banksModes,
                shifterIdColor: shifterIdColor,
                hwconfig: { ...prevState.hwconfig, banksModes: banksModes }
            });
        });
    }

    closeLoadConfigModal = () => {
        this.setState({ selectAndLoadOpen: false })
    }

    handleDesktopFile(event) {
        let input = event.target;

        let reader = new FileReader();
        reader.onload = function () {
            let config = JSON.stringify(reader.result);
            this.validateConfig(config);
        }.bind(this);
        reader.readAsText(input.files[0]);
    }

    handleLoadFromDesktop(deviceName, idx) {
        if (deviceName) {
            this.closeLoadConfigModal();
            this.setState({ currentDeviceName: deviceName, inputSelected: idx })
        }
        createFileInput(this.handleDesktopFile);
    }

    handleLoadFromAccount(deviceName, output_idx) {
        // NOT IMPLEMENTED
        /*
        console.log('loading:',deviceName, output_idx)
        console.log('kmx inputs:', this.state.inputsAccess);

        if (deviceName) {
            this.closeLoadConfigModal();
        } else {
            if (this.state.inputSelected === -1) {
                this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                    variant: "error"
                })
                return;
            }
            deviceName = this.state.inputs[this.state.inputSelected];
            output_idx = this.state.inputSelected;
        }

        this.setState({currentDeviceName: deviceName, inputSelected: output_idx})

        if (this.state.loading) {
            return;
        }

        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: "error"
            });
            return;
        }
        this.setState({loading: true}, async () => {
            this.props.enqueueSnackbar(INFO_LOADING_CONFIG_FROM_ACCOUNT,{
                variant: 'info'
            })
            let generalConfig = await this.getGeneralConfigBlock(output_idx);
            console.log('>> GENERAL CONFIG:', generalConfig)
            if (generalConfig === null || generalConfig === undefined) {
                this.setState({loading: false}, () => this.props.enqueueSnackbar('Could not load config from account', {
                    variant: 'error'
                }))
                return;
            }
            let { device_name: realDeviceName, usb_serial: serial } = generalConfig;
            this.backendWebSocket.send(JSON.stringify({'message': {
                'command':'get-config',
                'subcommand':'account',
                'device_name': realDeviceName,
                'serial': serial
            }}))
            console.log('>> BACKEND MESSAGE SENT:', realDeviceName, serial);
        })*/
    }

    handleLoadDefaultConfig = (deviceName, output_idx) => {
        console.log('loading default config:', deviceName, output_idx)

        if (deviceName) {
            this.closeLoadConfigModal();
        } else {
            if (this.state.inputSelected === -1) {
                this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                    variant: "error"
                })
                return;
            }
            deviceName = this.state.inputs[this.state.inputSelected];
            output_idx = this.state.inputSelected;
        }


        if (this.state.loading) {
            return;
        }

        this.setState({ currentDeviceName: deviceName, inputSelected: output_idx, onHardwareConfig: false })

        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: "error"
            });
            return;
        }
        this.setState({ loading: true }, async () => {
            this.props.enqueueSnackbar(INFO_LOADING_DEFAULT_CONFIG, {
                variant: 'info'
            })
            _.find(this.state.outputsAccess, (port, idx) => {
                if (port.name === deviceName) {
                    output_idx = idx;
                    return true;
                }
                return false;
            })
            let generalConfig = await this.getGeneralConfigBlock(output_idx);
            // controller has no valid config, go to hardware config view
            if (generalConfig === false) {
                this.setState({ onHardwareConfig: true, loading: false, invalidHWConfig: false })
                return
            }
            console.log('>> GENERAL CONFIG:', generalConfig)
            if (generalConfig === null || generalConfig === undefined) {
                this.setState({ loading: false, currentDeviceName: null, inputSelected: -1 }, () => this.props.enqueueSnackbar(ERROR_GETTING_BLOCK_ZERO, {
                    variant: 'error'
                }))
                return;
            }
            // YGR: Put the firmware version from the controller in state, instead of the one which will come from default config
            this.setState({
                hwConfig: {
                    'fw_version_major': generalConfig['fw_version_major'],
                    'fw_version_minor': generalConfig['fw_version_minor']
                }
            })
            let { device_name: realDeviceName, usb_serial: serial } = generalConfig;
            this.backendWebSocket.send(JSON.stringify({
                'message': {
                    'command': 'get-config',
                    'subcommand': 'default',
                    'device_name': realDeviceName,
                    'serial': serial
                }
            }))
            console.log('>> BACKEND MESSAGE SENT:', realDeviceName, serial);
        })
    }

    handleLoadFromController(deviceName, output_idx) {

        if (deviceName) {
            this.closeLoadConfigModal();
        } else {
            if (this.state.inputSelected === -1) {
                this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                    variant: "error"
                })
                return;
            }
            deviceName = this.state.inputs[this.state.inputSelected];
            output_idx = this.state.inputSelected;
        }

        this.setState({ currentDeviceName: deviceName, inputSelected: output_idx })

        if (this.state.loading) {
            return;
        }

        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: "error"
            });
            return;
        }

        this.setState({ loading: true }, async () => {
            this.props.enqueueSnackbar(INFO_LOADING_CTRL_CONFIG, {
                variant: 'info'
            })
            _.find(this.state.outputsAccess, (port, idx) => {
                if (port.name === deviceName) {
                    output_idx = idx;
                    return true;
                }
                return false;
            })
            let generalConfig = await this.getGeneralConfigBlock(output_idx);
            // controller has no valid config, go to hardware config view
            if (generalConfig === false) {
                this.setState({ onHardwareConfig: true, loading: false, invalidHWConfig: false })
                return
            }

            console.log('>> GENERAL CONFIG:', generalConfig)
            if (generalConfig === null || generalConfig === undefined) {
                this.setState({ loading: false }, () => this.props.enqueueSnackbar(ERROR_GETTING_BLOCK_ZERO, {
                    variant: 'error'
                }))
                return;
            }
            let { device_name: realDeviceName, usb_serial: serial, signature, banksNumber, remoteBanks } = generalConfig;
            console.log('SIGNATURE:', signature)
            // TODO couldn't we use a function from config.js, lighter than populateConfig?
            this.setState({
                hwconfig: _.cloneDeep(generalConfig),
                generalConfig: undefined,
                banksButtonsId: generalConfig['banksIds'],
                rainbow: generalConfig['rainbow'],
                takeover: generalConfig['takeover'],
                dumpStateOnStartup: generalConfig['dumpStateOnStartup'],
                rememberState: generalConfig['rememberState'],
                midiMergeOption: generalConfig['midiMergeOption'],
                fwVersion: [generalConfig['fw_version_major'], generalConfig['fw_version_minor']],
                hwVersion: [generalConfig['hw_version_major'], generalConfig['hw_version_minor']],
                currentSerialNumber: serial,
                remoteBanks: remoteBanks
            }, () => this.backendWebSocket.send(JSON.stringify({
                'message': {
                    'command': 'get-config',
                    'subcommand': 'ctrl',
                    'device_name': realDeviceName,
                    'serial': serial,
                    'signature': signature,
                    'banks_number': banksNumber
                }
            }))
            )
        })

        return;
    }

    getCompleteConfigFromController = async (controllerLayout, getCommands) => {

        /*_.forEach(getCommands, async (cmd) => {
            this.setState({validBlockReceived: false}, async () => {
                await sleep(100);
                await this.sendSysexToDevice(cmd);
            })
            //sleep(100);

            if (!validBlock) {
                this.setState({loading: false})
                this.props.enqueueSnackbar("Did not receive valid config block from controller in time",{
                    variant: "error"
                })
                return;
            }
        })*/
        for (let cmd of getCommands) {
            await this.sendSysexToDevice(cmd);
            await sleep(10);
            let validBlock = await this.waitFor(2000, 'validBlockReceived', true)
        }
        this.setState({ validBlockReceived: false })
    }

    setInitialStateForController = async () => {

        let banksNumber = Object.keys(this.state.banks).length;
        let hwconfig = this.state.hwconfig;

        let bankButtonsInUse = [];
        let shifterIdBank = {};
        let shifterIdColor = {}
        let encodersCount = Object.keys(this.state.banks['0']['encoders']).length;
        let digitalsCount = Object.keys(this.state.banks['0']['digitals']).length;
        let analogsCount = Object.keys(this.state.banks['0']['analogs']).length;

        for (var i = 0; i < banksNumber; i++) {
            let button = hwconfig.banksIds[i];
            let component;
            let channel;
            let shifterIdx;
            let sectionKey;
            let shifterColor;

            if (button !== BANK_NONE_ID) {
                component = button < encodersCount ? 'encoders' : 'digitals';
                shifterIdx = component === 'encoders' ? button : button - encodersCount;
                sectionKey = component === 'encoders' ? 'switch_feedback' : 'feedback_config';
                shifterColor = _.cloneDeep(this.state.banks[i][component][shifterIdx][sectionKey].color);
                channel = _.cloneDeep(this.state.banks[i][component][shifterIdx][sectionKey].channel);
                bankButtonsInUse.push(button);
                shifterIdBank[button] = i;
                shifterIdColor[button] = shifterColor;
            }
            if (component === 'encoders') {
                this.state.banks[i].color = _.isEqual(shifterColor, DEFAULT_SWITCH_COLOR) ? "None" : shifterColor;
            } else if (component === 'digitals') {
                this.state.banks[i].color = _.isEqual(shifterColor, DEFAULT_DIGITAL_COLOR) ? "None" : shifterColor;
            } else {
                this.state.banks[i].color = "None"
            }
            this.state.banks[i].button = button === BANK_NONE_ID ? "None" : button.toString();
            this.state.banks[i].mode = BANK_MODE[hwconfig.banksModes[i]];
            this.state.banks[i].midi_ch = channel ? (channel + 1).toString() : "None";
            if (component === 'encoders') {
                this.assignBankToEncoderSwitch(shifterIdx);
            } else if (component === 'digitals') {
                this.assignBankToDigital(shifterIdx, i + 1);
            }
        }

        this.setState((prevState) => {
            return ({
                banksNumber: banksNumber,
                componentsCount: encodersCount + digitalsCount + analogsCount,
                bankButtonsInUse: bankButtonsInUse,
                banksModes: hwconfig.banksModes,
                shifterIdBank: shifterIdBank,
                shifterIdColor: shifterIdColor,
                loading: false,
                detectDevices: false,
                configLoaded: true,
                hwConfigDeviceName: hwconfig.device_name
            })
        }, () => {
            this.props.enqueueSnackbar(SUCCESS_CONFIG_LOADED, {
                variant: "success"
            });
            warnIfOldFirmware(hwconfig, this.props.enqueueSnackbar, this.props.closeSnackbar);
        })
    }

    setNewSection = (bank, block, section, data) => {
        let expectedSections = this.state.expectedSections - 1;
        this.setState((prevState) => {
            let banks = prevState.banks;
            //let component = block === 1 ? 'encoders' : (block === 2 ? 'analogs' : 'digitals')

            if (!banks.hasOwnProperty(bank)) {
                banks[bank] = {}
                banks[bank]['encoders'] = {}
                banks[bank]['digitals'] = {}
                banks[bank]['analogs'] = {}
                banks[bank]['feedbacks'] = {}
            }
            if (!banks[bank].hasOwnProperty(block)) {
                banks[bank][block] = {}
            }
            banks[bank][block][section] = data
            if (block === 'analogs') {
                banks[bank][block][section]['has_feedback'] = this.state.analogsWithFeedback[section];
            }
            prevState.banks = banks;
            prevState.validBlockReceived = true;
            prevState.expectedSections = expectedSections;

            return prevState;
        }, () => {
            //console.log(expectedSections)
            if (expectedSections === 0) {
                console.log('BANKS:', this.state.banks)
                console.log('SETTING INITIAL STATE FOR CONTROLLER')
                this.setInitialStateForController()
            }
        })
    }

    handleSaveToAccount() {
        /*
        if (this.state.saving) {
            return;
        }
        this.setState({saving: true}, () => this.saveToAccount())*/
    }

    handleSaveToDesktop() {
        if (this.state.saving) {
            return;
        }
        this.setState({ saving: true }, () => this.saveToAccount(true))
    }

    saveToAccount(copyToDesktop = false) {
        this.props.enqueueSnackbar(INFO_VALIDATING_CONFIG, {
            variant: 'info',
        })

        let config = {};

        config.hwconfig = this.state.hwconfig;
        config.banks = this.state.banks;
        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.setState({ saving: false }, () => this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: 'error'
            }));
            return;
        }
        let onlyAccount = !copyToDesktop;
        this.backendWebSocket.send(JSON.stringify({ 'message': { 'config': JSON.stringify(config), 'command': 'save-config', 'only-to-account': onlyAccount } }))
    }

    onFilterSelected(filter) {
        console.log("FILTER:", filter)
        this.setState((prevState) => { return ({ filter: { ...prevState.filter, type: filter } }) });
    }

    onFilterSearch(search) {
        console.log("SEARCH:", search);
        this.setState((prevState) => { return ({ filter: { ...prevState.filter, search: search } }) });
    }

    getGeneralConfigBlock = async (output_idx) => {
        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.setState({ loading: false }, () => this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: 'error'
            }));
            return;
        }

        let output = this.state.outputsAccess[output_idx];
        if (!output) {
            this.setState({ loading: false }, () => this.props.enqueueSnackbar(WARNING_NO_DEVICE_SELECTED, {
                variant: 'error'
            }));
            return;
        }

        this.backendWebSocket.send(JSON.stringify({ 'message': { 'command': 'get-block', 'block': 0, 'output_id': output.id, 'random': uuid() } }));

        await this.waitFor(5000, 'validBlockReceived', true);

        let retValue = null;

        if (this.state.validBlockReceived && this.state.invalidHWConfig === true) {
            this.props.enqueueSnackbar(INFO_INVALID_HW_CONFIG, {
                variant: 'info'
            })
            retValue = false;
        } else if (this.state.validBlockReceived) {
            retValue = this.state.generalConfig;
        }

        this.setState({ validBlockReceived: false })

        return retValue;
    }

    onCapture = (e, captureOn) => {
        e.persist();
        if (this.state.capturing) {
            this.setState({ capturing: false, blinkIdx: -1, blinkType: '', lastBlinkIdx: -1, lastBlinkType: '' })
            e.target.checked = false;
        } else {
            this.setState({ capturing: true })
        }
        this.sendCaptureRequestToBackend(captureOn);
        /*this.handleComponentCapture('encoder',0,null);
        if (this.state.monitoring) {
            this.handleMidiMonitorData('controller', 1, 'Note On', 66);
        }*/
    }

    sendCaptureRequestToBackend = (captureFlag) => {
        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.setState({ saving: false }, () => this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: 'error'
            }));
            return;
        }
        this.backendWebSocket.send(JSON.stringify({ 'message': { 'command': 'special-requests', 'subcommand': 'capture', 'capture_on': captureFlag } }))
    }

    requestCaptureToDevice = async (captureCmd, captureOn) => {
        let captureMessage = captureOn ? 'On' : 'Off';
        let outputPort = this.getOutputPort();
        if (!outputPort) return;
        console.log(outputPort.id)
        this.sendSysexToDevice(captureCmd);

        let ack = await this.waitFor(2000, outputPort.id, true);
        console.log(ack)
        if (!this.state[outputPort.id]) {
            this.setState({ capturing: false })
            this.props.enqueueSnackbar(ERROR_WAITING_ACK_FOR_CAPTURE_MODE, {
                variant: "error"
            })
        } else {
            this.props.enqueueSnackbar(SUCCESS_CAPTURE_MODE_SWITCHED + captureMessage, {
                variant: "success"
            })
        }
        this.setState({ [outputPort.id]: false })
    }

    handleComponentCapture = (block, section, new_value) => {
        let elementType = block;
        let encodersNum = Object.keys(this.state.banks[0].encoders).length;
        let digitalsNum = Object.keys(this.state.banks[0].digitals).length;
        if (section >= encodersNum && section < encodersNum + digitalsNum) {
            section = section - encodersNum;
        } else if (section >= encodersNum) {
            section = section - encodersNum - digitalsNum;
        }
        if (Object.keys(this.state.banks[this.state.currentBank][elementType]).length > section) {
            this.handleElementBlink(true, section, elementType);
            //this.handleElementSelected(section, block, undefined, true);
        }
    }

    handleMidiMonitorToggle = () => {
        this.setState((prevState) => {
            // FOR DEBUGGING
            //if (this.monitorInterval) clearInterval(this.monitorInterval);
            //if (!prevState.monitoring) {
            //    this.monitorInterval = setInterval(this.midiMonitorInterval, 100)
            //}
            return ({
                monitoring: !prevState.monitoring,
            })
        })
    }

    // MIDI MONITOR DEBUG METHOD
    midiMonitorInterval = () => {
        this.handleMidiMonitorData(0xE, 1, Math.floor(Math.random() * (127 - 1 + 1)) + 1, Math.floor(Math.random() * (127 - 1 + 1)) + 1)
    }

    handleTakeoverMode = (takeover) => {
        this.setState((prevState) => {
            return ({
                takeover: takeover,
                hwconfig: { ...prevState.hwconfig, takeover: takeover }
            })
        })
    }

    handleRainbowToggle = () => {
        this.setState((prevState) => {
            return ({
                rainbow: !prevState.rainbow,
                hwconfig: { ...prevState.hwconfig, rainbow: !prevState.rainbow }
            })
        })
    }

    handleRemoteBanksToggle = () => {
        this.setState((prevState) => {
            return ({
                remoteBanks: !prevState.remoteBanks,
                hwconfig: { ...prevState.hwconfig, remoteBanks: !prevState.remoteBanks }
            })
        })
    }

    handleRememberStateToggle = () => {
        this.setState((prevState) => {
            return ({
                rememberState: !prevState.rememberState,
                hwconfig: { ...prevState.hwconfig, rememberState: !prevState.rememberState }
            })
        })
    }

    handleDumpStateOnStartupToggle = () => {
        this.setState((prevState) => {
            return ({
                dumpStateOnStartup: !prevState.dumpStateOnStartup,
                hwconfig: { ...prevState.hwconfig, dumpStateOnStartup: !prevState.dumpStateOnStartup }
            })
        })
    }

    resetEeprom = async () => {
        let requestId = uuid();
        if (this.backendWebSocket.readyState !== this.backendWebSocket.OPEN) {
            this.setState({ saving: false }, () => this.props.enqueueSnackbar(ERROR_WEBSOCKET_CLOSED, {
                variant: 'error'
            }));
            return;
        }
        this.backendWebSocket.send(JSON.stringify({ 'message': { 'command': 'special-requests', 'subcommand': 'reset', 'request_id': requestId } }))

        let resetCmdReceived = await this.waitFor(2000, requestId, true);
        if (resetCmdReceived) {
            this.props.enqueueSnackbar(INFO_SENDING_RESET_COMMAND, {
                variant: "info"
            })

            this.sendSysexToDevice(this.state.resetCommand)
        }
    }

    getNextShifterIdAvailable = () => {
        let encodersCount = Object.keys(this.state.banks['0']['encoders']).length;
        let digitalsCount = Object.keys(this.state.banks['0']['digitals']).length;
        //console.log('>> bank buttons in use:', this.state.bankButtonsInUse)
        for (let i = 0; i < encodersCount; i++) {
            if (!this.state.bankButtonsInUse.includes(i)) {
                //console.log('>>', i, 'is not in use')
                return i;
            }
        }
        for (let i = encodersCount; i < (encodersCount + digitalsCount); i++) {
            if (!this.state.bankButtonsInUse.includes(i)) {
                return i;
            }
        }
        return "None";
    }

    handleFirmwareUpdateBehaviour = (parameter, option) => {
        return;
    }

    render() {
        return (
            <LoadingOverlay
                active={this.state.configuring || this.state.detectingDevices || this.state.loading}
                spinner
                text={this.state.configuring ? 'Configuring your device...' : (this.state.loading ? 'Loading Config... ' : 'Detecting devices...')}
            >
                <div className="App">
                    <ReactTooltip delayShow={200} place="left" effect="solid" backgroundColor="rgb(46, 46, 46)" borderColor="#43ABDC"/>
                    <ModalVideo channel="youtube"
                        isOpen={this.state.introVideoOpen}
                        onClose={() => this.setState({ introVideoOpen: false })}
                        videoId={INTRO_VIDEO_ID}
                    />
                    <SelectAndLoadDialog
                        open={this.state.selectAndLoadOpen}
                        devices={this.state.inputs}
                        hiddenDevices={this.state.hiddenDevices}
                        onClose={this.closeLoadConfigModal}
                        onLoadFromCtrl={this.handleLoadFromController}
                        onLoadDefaultConfig={this.handleLoadDefaultConfig}
                        onLoadFromFile={this.handleLoadFromDesktop}
                        updateInput={this.updateInput}
                    />
                    <Toolbar
                        fwVersion={this.state.fwVersion}
                        hwVersion={this.state.hwVersion}
                        onFilterChange={this.handleChange}
                        onShowElementsChange={this.handleShowChange}
                        filter={this.state.filter}
                        showElementsOptions={this.state.showElementsOptions}
                        clickHardwareConfig={this.onEnterHardwareConfig}
                        inputs={this.state.inputs}
                        hiddenDevices={this.state.hiddenDevices}
                        outputs={this.state.outputs}
                        updateInput={this.updateInput}
                        selectedDevice={this.state.currentDeviceName}
                        midiMergeOption={this.state.midiMergeOption}
                        takeoverMode={this.state.takeover}
                        rainbow={this.state.rainbow}
                        remoteBanks={this.state.remoteBanks}
                        rememberState={this.state.rememberState}
                        onRememberStateToggle={this.handleRememberStateToggle}
                        dumpStateOnStartup={this.state.dumpStateOnStartup}
                        onDumpStateOnStartupToggle={this.handleDumpStateOnStartupToggle}
                        updateOutput={this.updateOutput}
                        refreshPorts={this.refreshPorts}
                        updateMidiMerge={this.updateMidiMerge}
                        onCapture={this.onCapture}
                        onMidiMonitorToggle={this.handleMidiMonitorToggle}
                        onTakeoverSelect={this.handleTakeoverMode}
                        onRainbowToggle={this.handleRainbowToggle}
                        onRemoteBanksToggle={this.handleRemoteBanksToggle}
                        loadFromDesktop={this.handleLoadFromDesktop}
                        /*loadFromAccount={this.handleLoadFromAccount}*/
                        loadFromController={this.handleLoadFromController}
                        loadDefaultConfig={this.handleLoadDefaultConfig}
                        /*saveToAccount={this.handleSaveToAccount}*/
                        saveToDesktop={this.handleSaveToDesktop}
                        takeoverOptions={this.state.takeoverOptions}
                        resetEeprom={this.resetEeprom}
                        onShowIntroVideo={() => this.setState({ introVideoOpen: true })}
                    />
                    <main>
                        <div className='main__container_one'>
                            {((!this.state.configLoaded && !this.state.onHardwareConfig) &&
                                <LandingPage
                                    onClick={this.handleLoadFromDesktop}
                                />) ||
                                (this.state.onHardwareConfig &&
                                    <HardwareConfig
                                        isActive={this.state.configuring}
                                        click={this.onExitHardwareConfig}
                                        configHW={this.onConfigHardwareMapping}
                                    />) ||
                                (!this.state.onHardwareConfig && this.state.configLoaded &&
                                    <ElementsView
                                        isActive={this.state.configuring}
                                        banks={this.state.banks}
                                        selectBank={this.handleBankSelect}
                                        banksNumber={Object.keys(this.state.banks).length}
                                        currentBank={this.state.currentBank}
                                        maxBanksNumber={this.state.maxBanksNumber}
                                        elementSelected={this.handleElementSelected}
                                        onChange={this.onFilterSelected}
                                        onSearch={this.onFilterSearch}
                                        filter={this.state.filter}
                                        outOfSync={this.state.outOfSync}
                                        blinkIdx={this.state.blinkIdx}
                                        blinkType={this.state.blinkType}
                                        lastBlinkIdx={this.state.lastBlinkIdx}
                                        lastBlinkType={this.state.lastBlinkType}
                                        loading={this.state.loading}
                                    />)}
                        </div>
                        {!this.state.onHardwareConfig && this.state.configLoaded &&
                            <div className='main__container-two'>
                                <DrawerToggleButton
                                    click={this.drawerToggleClickHandler}
                                    className={this.state.drawerClass}
                                    id={this.state.drawerId}
                                />
                            </div>
                        }
                        {!this.state.onHardwareConfig && this.state.drawerOpen && this.state.configLoaded &&
                            <div className='main__container-three'>
                                <SideDrawer
                                    drawerId={this.state.drawerId}
                                    currentElement={this.state.currentElement}
                                    handlePropertyUpdate={this.handlePropertyUpdate}
                                    currentBank={this.state.currentBank}
                                    banks={this.state.banks}
                                    banksNumber={Object.keys(this.state.banks).length}
                                    bankButtonOptions={this.getBankButtonOptions()}
                                    bankButtonSelect={this.handleBankButtonSelect}
                                    bankModeSelect={this.handleBankModeSelect}
                                    bankMidiChSelect={this.handleBankMidiChSelect}
                                    bankColorSelect={this.handleBankColorSelect}
                                    addBank={this.handleAddBank}
                                    deleteBank={this.handleBankDelete}
                                    duplicateBank={this.handleBankDuplicate}
                                    passDataToBank={this.handlePassDataToBank}
                                    maxBanksNumber={this.state.maxBanksNumber}
                                    switchColorRangeList={this.state.hwconfig.switchFeedbackColorList}
                                    digitalColorRangeList={this.state.hwconfig.digitalFeedbackColorList}
                                    analogColorRangeList={this.state.hwconfig.analogFeedbackColorList}
                                    loading={this.state.loading}
                                    fwVersion={this.state.fwVersion}
                                />
                            </div>
                        }
                    </main>
                    <Footer
                        sendToDevice={this.handleSendToDevice}
                        monitorData={this.state.monitorData}
                        deviceLinked={this.state.currentDeviceName !== null}
                        configInSync={this.state.currentDeviceName !== null && _.isEmpty(this.state.outOfSync)}
                    />
                </div>
            </LoadingOverlay>
        );
    }
}

export default withSnackbar(App);
