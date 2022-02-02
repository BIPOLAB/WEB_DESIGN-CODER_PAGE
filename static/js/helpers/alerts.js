const option = null;
const bankId = null;


// INFO
export const INFO_MI_CONNECTED = "Muted Instruments device connected!";
export const INFO_CAPTURE_TOGGLE = "Sending capture request to controller";
export const INFO_OPENING_HW_CONFIG = "Controller has not a valid config. Opening Hardware Config...";
export const INFO_BANK_SHIFTER_IN_USE = `${option} id is already in use by bank ${bankId}. Please select another one`;
export const INFO_BANK_CAPTURE_ON = "Please click on a switch encoder or digital card on the screen.";
export const INFO_LOADING_CONFIG_FROM_ACCOUNT = "Loading config from account, please wait...";
export const INFO_LOADING_DEFAULT_CONFIG = "Loading default config from server, please wait...";
export const INFO_LOADING_CTRL_CONFIG = "Loading config from controller, please wait...";
export const INFO_VALIDATING_CONFIG = "Verifying and saving config, wait a moment please...";
export const INFO_INVALID_HW_CONFIG = "Invalid HwConfig";
export const INFO_SENDING_RESET_COMMAND = "Sending Reset Command to device";

// WARNING
export const WARNING_NO_DEVICE_SELECTED = "A device must be selected in preferences menu";
export const WARNING_QSTB_CURRENT_BANK = ": Selected bank is equal to current bank"; // prepended by bank_id selected

// SUCCESS
export const SUCCESS_PORTS_REFRESHED = "Ports refreshed";
export const SUCCESS_CONFIG_UPLOADED = "Config saved to account";
export const SUCCESS_CONFIG_READY_TO_DOWNLOAD = "Config ready to save";
export const SUCCESS_CONFIG_LOADED = "Config loaded successfully";
export const SUCCESS_BACKEND_CONN_UP = "Connection with Server restablished!";
export const SUCCESS_CAPTURE_MODE_SWITCHED = "Capture Mode "; // + capture mode (ON|OFF)

// ERROR
export const ERROR_WEBSOCKET_CLOSED = "Connection with Server is closed, reconnecting... Please try again later!";
export const ERROR_HANDSHAKE_NO_DEVICE = "Could not send handshake request to device. Select a device from preferences menu.";
export const ERROR_HANDSHAKE_SERVER_NO_ANSWER = "Could not send handshake request to device";
export const ERROR_NO_ACK_RECEIVED = "Did not received ACK from device on time. Config cancelled...";
export const ERROR_CONFIG_INVALID_PID = "Invalid PID, it must be a hex value between 0000 and 3fff";
export const ERROR_CONFIG_DEVICE_NAME = "Device name must not be empty and it must be 15 characters long at most";
export const ERROR_CONFIG_USB_SERIAL = "USB Serial must not be empty and it must be 9 characters long at most";
export const ERROR_FAILED_DEFAULT_CONFIG = "Failed initial config!";
export const ERROR_FAILED_BUILDING_CONFIG = "Error packaging new config for device: "; // + error message
export const ERROR_SENDING_CONFIG = "Failed sending config!";
export const ERROR_BACKEND_REQUEST_SPECIAL_COMMAND = "Error while asking for: "; // + subcommand + backend error message
export const ERROR_BACKEND_SAVING_CONFIG = "Error saving config";
export const ERROR_BACKEND_REQUESTING_BLOCK_COMMAND = "Error while getting config block: "; // + error message
export const ERROR_BACKEND_REQUESTING_GET_CONFIG_COMMANDS = "Error while loading config: "; // + error message
export const ERROR_CONFIG_INVALID = "Config is not valid: "; // + error message
export const ERROR_GETTING_BLOCK_ZERO = "Could not get device BLOCK 0 to load config";
export const ERROR_WAITING_ACK_FOR_CAPTURE_MODE = "Did not receive Ack for Capture Mode";