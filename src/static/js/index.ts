let isActive = false;

let bluetoothEnabled = false;
let gxEnabled = false;
const selectedComPorts: string[] = [];

let fpsMode = 50;
let sensorMode = 2;
let accelerometerEnabled = false;
let gyroscopeEnabled = false;
let magnetometerEnabled = false;

let canLogToFile = false;
let skipSlimeVRCheck = false;
let bypassCOMPortLimit = false;
let debugTrackerConnections = false;

let language = "en";
let censorSerialNumbers = false;

// TODO add BT settings to package and add tracker visualization
// todo feature to hide bt tracker serials

/*
 * Renderer functions
 */

document.addEventListener("DOMContentLoaded", async function () {
    window.log("DOM loaded");

    // Populate COM port switches
    const comPortList = document.getElementById("com-ports");
    const comPorts: string[] = await window.ipc.invoke("get-com-ports", null);

    window.log(`COM ports: ${JSON.stringify(comPorts)}`);

    let rowHTML = '<div class="com-port-row">';
    comPorts.forEach((port: string, index: number) => {
        const switchHTML = `
        <div class="switch-container">
            <div class="switch">
            <input type="checkbox" id="${port}" />
            <label for="${port}" class="slider round"></label>
            </div>
            <label for="${port}">${port}</label>
        </div>
        `;

        rowHTML += switchHTML;

        // If there are two COM ports in the row or if this is the last COM port, add the row to the list
        if ((index + 1) % 2 === 0 || index === comPorts.length - 1) {
            rowHTML += "</div>";
            comPortList.innerHTML += rowHTML;
            rowHTML = '<div class="com-port-row">';
        }
    });

    // Populate language select
    const languageSelect = document.getElementById(
        "language-select"
    ) as HTMLSelectElement;
    const languages: string[] = await window.ipc.invoke("get-languages", null);

    languages.forEach((language: string) => {
        const option = document.createElement("option");
        option.value = language;
        option.text = language;
        languageSelect.appendChild(option);
    });

    // Get settings from config file
    const settings: { [key: string]: any } = await window.ipc.invoke(
        "get-settings",
        null
    );
    language = settings.global?.language || "en";
    censorSerialNumbers = settings.global?.censorSerialNumbers || false;
    bluetoothEnabled =
        settings.global?.connectionMode?.bluetoothEnabled || false;
    gxEnabled = settings.global?.connectionMode?.gxEnabled || false;
    fpsMode = settings.global?.trackers?.fpsMode || 50;
    sensorMode = settings.global?.trackers?.sensorMode || 2;
    accelerometerEnabled =
        settings.global?.trackers?.accelerometerEnabled || true;
    gyroscopeEnabled = settings.global?.trackers?.gyroscopeEnabled || false;
    magnetometerEnabled =
        settings.global?.trackers?.magnetometerEnabled || false;
    canLogToFile = settings.global?.debug?.canLogToFile || false;
    skipSlimeVRCheck = settings.global?.debug?.skipSlimeVRCheck || false;
    bypassCOMPortLimit = settings.global?.debug?.bypassCOMPortLimit || false;
    debugTrackerConnections =
        settings.global?.debug?.debugTrackerConnections || false;

    // Get the checkbox elements
    const censorSerialNumbersSwitch = document.getElementById(
        "censor-serial-switch"
    ) as HTMLInputElement;
    const bluetoothSwitch = document.getElementById(
        "bluetooth-switch"
    ) as HTMLInputElement;
    const gxSwitch = document.getElementById("gx-switch") as HTMLInputElement;
    const accelerometerSwitch = document.getElementById(
        "accelerometer-switch"
    ) as HTMLInputElement;
    const gyroscopeSwitch = document.getElementById(
        "gyroscope-switch"
    ) as HTMLInputElement;
    const magnetometerSwitch = document.getElementById(
        "magnetometer-switch"
    ) as HTMLInputElement;
    const logToFileSwitch = document.getElementById(
        "log-to-file-switch"
    ) as HTMLInputElement;
    const skipSlimeVRSwitch = document.getElementById(
        "skip-slimevr-switch"
    ) as HTMLInputElement;
    const bypassCOMPortLimitSwitch = document.getElementById(
        "bypass-com-limit-switch"
    ) as HTMLInputElement;
    const debugTrackerConnectionsSwitch = document.getElementById(
        "debug-tracker-connections-switch"
    ) as HTMLInputElement;

    // Set the checked property based on the settings
    censorSerialNumbersSwitch.checked = censorSerialNumbers;
    bluetoothSwitch.checked = bluetoothEnabled;
    gxSwitch.checked = gxEnabled;
    accelerometerSwitch.checked = accelerometerEnabled;
    gyroscopeSwitch.checked = gyroscopeEnabled;
    magnetometerSwitch.checked = magnetometerEnabled;
    logToFileSwitch.checked = canLogToFile;
    skipSlimeVRSwitch.checked = skipSlimeVRCheck;
    bypassCOMPortLimitSwitch.checked = bypassCOMPortLimit;
    debugTrackerConnectionsSwitch.checked = debugTrackerConnections;

    // Get the select elements
    const fpsSelect = document.getElementById(
        "fps-mode-select"
    ) as HTMLSelectElement;
    const sensorModeSelect = document.getElementById(
        "sensor-mode-select"
    ) as HTMLSelectElement;

    // Set the selected option based on the settings
    fpsSelect.value = fpsMode.toString();
    sensorModeSelect.value = sensorMode.toString();
    languageSelect.value = language.toString();

    // Set the selected COM ports
    const comPortsSwitches = Array.from(
        document.getElementById("com-ports").querySelectorAll("input")
    );
    const selectedPorts: string[] =
        settings.global?.connectionMode?.comPorts || [];

    comPortsSwitches.forEach((port) => {
        if (selectedPorts.includes(port.id)) {
            port.checked = true;
        }
    });

    // Check if the selected COM ports are still available
    let isMissingPorts = false;
    selectedPorts.forEach((port) => {
        if (!comPorts.includes(port)) {
            window.log(
                `COM port ${port} in config was not found in user's available COM ports`
            );
            selectedPorts.splice(selectedPorts.indexOf(port), 1);
            isMissingPorts = true;
        }
    });

    if (isMissingPorts) {
        setStatus(window.translate("main.status.comPortsMissing"));
        window.ipc.send("show-error", {
            title: window.translate("dialogs.comPortsMissing.title"),
            message: window.translate("dialogs.comPortsMissing.message"),
        });
    }

    selectedComPorts.push(...selectedPorts);

    window.log(`Settings loaded:\r\n${JSON.stringify(settings, null, 4)}`);

    setStatus(window.translate("main.status.none"));
    document.getElementById("tracker-count").textContent = document
        .getElementById("tracker-count")
        .textContent.replace("{trackerCount}", "0");

    window.changeLanguage(language);

    addEventListeners();
});

async function startConnection() {
    window.log("Starting connection...");

    const slimeVRFound: boolean = await window.ipc.invoke(
        "is-slimevr-connected",
        null
    );
    if (!slimeVRFound && !skipSlimeVRCheck) {
        window.error(
            "Tried to start connection while not connected to SlimeVR"
        );
        setStatus(window.translate("main.status.slimeVRMissing"));
        return;
    } else if (!slimeVRFound && skipSlimeVRCheck) {
        window.log("SlimeVR check skipped");
    }

    if (bluetoothEnabled && gxEnabled) {
        window.ipc.send("start-connection", {
            types: ["bluetooth", "gx"],
            ports: selectedComPorts,
            isActive,
        });
        window.log(
            `Starting Bluetooth and GX connection with ports: ${selectedComPorts}`
        );
    } else if (bluetoothEnabled) {
        window.ipc.send("start-connection", { types: ["bluetooth"], isActive });
        window.log("Starting Bluetooth connection");
    } else if (gxEnabled) {
        window.ipc.send("start-connection", {
            types: ["gx"],
            ports: selectedComPorts,
            isActive,
        });
        window.log(`Starting GX connection with ports: ${selectedComPorts}`);
    } else {
        window.error("No connection mode enabled");
        setStatus(window.translate("main.status.noConnectionMode"));
        window.ipc.send("show-error", {
            title: window.translate("dialogs.noConnectionMode.title"),
            message: window.translate("dialogs.noConnectionMode.message"),
        });
        return false;
    }

    // Disable start connection button and enable stop connection button
    document
        .getElementById("start-connection-button")
        .setAttribute("disabled", "true");
    document
        .getElementById("stop-connection-button")
        .removeAttribute("disabled");

    isActive = true;
}

function stopConnection() {
    if (!isActive || (!bluetoothEnabled && !gxEnabled)) {
        window.error("No connection to stop");
        window.error(
            "..wait a second, you shouldn't be seeing this! get out of inspect element and stop trying to break the program!"
        );
        return;
    }
    window.log("Stopping connection(s)...");

    // Enable start connection button and disable stop connection button
    document
        .getElementById("start-connection-button")
        .removeAttribute("disabled");
    document
        .getElementById("stop-connection-button")
        .setAttribute("disabled", "true");

    if (bluetoothEnabled) window.ipc.send("stop-connection", "bluetooth");
    if (gxEnabled) window.ipc.send("stop-connection", "gx");

    document.getElementById("tracker-count").textContent = "0";
    setStatus(window.translate("main.status.none"));
    document.getElementById("device-list").textContent = "";
    isActive = false;
}

function openLogsFolder() {
    window.log("Opening logs folder...");
    window.ipc.send("open-logs-folder", null);
}

// Save settings
function saveSettings() {
    window.log("Saving settings...");

    const comPorts: HTMLInputElement[] = Array.from(
        document.getElementById("com-ports").querySelectorAll("input")
    );
    const selectedPorts: string[] = [];

    comPorts.forEach((port) => {
        if (port.checked) {
            selectedPorts.push(port.id);
        }
    });

    window.log(`Selected COM ports: ${selectedPorts}`);

    window.ipc.send("save-setting", {
        global: {
            censorSerialNumbers: censorSerialNumbers,
            connectionMode: {
                bluetoothEnabled: bluetoothEnabled,
                gxEnabled: gxEnabled,
                comPorts: selectedPorts,
            },
            trackers: {
                fpsMode: fpsMode,
                sensorMode: sensorMode,
                accelerometerEnabled: accelerometerEnabled,
                gyroscopeEnabled: gyroscopeEnabled,
                magnetometerEnabled: magnetometerEnabled,
            },
            debug: {
                canLogToFile: canLogToFile,
                skipSlimeVRCheck: skipSlimeVRCheck,
                bypassCOMPortLimit: bypassCOMPortLimit,
                debugTrackerConnections: debugTrackerConnections,
            },
        },
    });

    let sensorAutoCorrection: string[] = []
    if (accelerometerEnabled) sensorAutoCorrection.push("accel");
    if (gyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (magnetometerEnabled) sensorAutoCorrection.push("mag");

    window.ipc.send("set-all-tracker-settings", {
        sensorMode,
        fpsMode,
        sensorAutoCorrection
    })

    window.log("Settings saved");
}

/*
 * Renderer helper functions
 */

function setStatus(status: string) {
    document.getElementById("status").textContent = status;
    window.log(`Set status to: ${status}`);
}

async function addDeviceToList(deviceID: string) {
    window.log(`Adding device to device list: ${deviceID}`);

    const settings: { [key: string]: any } = await window.ipc.invoke(
        "get-settings",
        null
    );
    const deviceList = document.getElementById("device-list");

    // Create a new div element
    const newDevice = document.createElement("div");
    newDevice.id = deviceID;
    newDevice.className = "column";

    // Check if device has a user-specified name
    const deviceName: string = settings.trackers?.[deviceID]?.name || deviceID;
    if (deviceName !== deviceID)
        window.log(`Got user-specified name for ${deviceID}: ${deviceName}`);

    // Fill the div with device data
    newDevice.innerHTML = `
    <div class="card" id="${deviceID}">
        <header class="card-header">
            <p class="card-header-title is-centered">
                Device:&nbsp;<span id="device-name">${deviceName}</span>
            </p>
            <div class="edit-button-container">
                <button id="edit-button" class="button is-info">Edit</button>
            </div>
        </header>
        <div class="card-content">
            <div class="content">
                <p>Device ID: <span id="device-id">${deviceID}</span></p>
                <p>Rotation Data: <span id="rotation-data">0, 0, 0</span></p>
                <p>Acceleration Data: <span id="acceleration-data">0, 0, 0</span></p>
                <p>Battery: <span id="battery">N/A</span></p>
            </div>
        </div>
        <footer class="card-footer">
            <div class="card-footer-item">
                <button id="tracker-settings-button" onclick="openTrackerSettings('${deviceID}')" class="button is-info">Override tracker settings</button>
            </div>
        </footer>
    </div>
    `;

    const deviceNameElement = newDevice.querySelector("#device-name");
    const editButton = newDevice.querySelector("#edit-button");

    function startEditing() {
        const originalName = deviceNameElement.textContent;

        const inputElement = document.createElement("input");
        inputElement.type = "text";
        inputElement.value = originalName;
        inputElement.id = "device-name-input";

        deviceNameElement.replaceWith(inputElement);

        inputElement.focus();

        // Add event listeners to handle when the input loses focus or the enter key is pressed
        inputElement.addEventListener("blur", handleNameChange);
        inputElement.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                handleNameChange();
            }
        });

        function handleNameChange() {
            inputElement.replaceWith(deviceNameElement);

            const newName = inputElement.value;
            deviceNameElement.textContent = newName;

            inputElement.removeEventListener("blur", handleNameChange);
            inputElement.removeEventListener("keydown", handleNameChange);

            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        name: newName,
                    },
                },
            });
        }
    }

    editButton.addEventListener("click", startEditing);
    deviceNameElement.addEventListener("click", startEditing);

    // Censor serial if BT tracker and censorSerialNumbers is enabled
    if (deviceID.startsWith("HaritoraXW") && censorSerialNumbers) {
        if (deviceName === deviceID)
            deviceNameElement.textContent = "HaritoraXW-XXXXXX";
        newDevice.querySelector("#device-id").textContent = "HaritoraXW-XXXXXX";
    } else if (deviceID.startsWith("HaritoraX") && censorSerialNumbers) {
        if (deviceName === deviceID)
            deviceNameElement.textContent = "HaritoraX-XXXXXX";
        newDevice.querySelector("#device-id").textContent = "HaritoraX-XXXXXX";
    }

    await window.ipc.send("get-tracker-battery", deviceID);

    deviceList.appendChild(newDevice);
}

/*
 * Event listeners
 */

window.ipc.on("localize", (_event, resources) => {
    window.localize(resources);
});

window.ipc.on("connect", async (_event, deviceID) => {
    window.log(`Connected to ${deviceID}`);
    addDeviceToList(deviceID);
    document.getElementById("tracker-count").textContent = (
        parseInt(document.getElementById("tracker-count").textContent) + 1
    ).toString();

    setStatus("connected");

    const settings = await window.ipc.invoke("get-settings", null);
    const exists = settings.trackers?.[deviceID] !== undefined;

    const trackerSettings = exists
        ? settings.trackers[deviceID]
        : await window.ipc.invoke("get-tracker-settings", {
              trackerName: deviceID,
          });
    setTrackerSettings(deviceID, trackerSettings);
});

function setTrackerSettings(deviceID: string, trackerSettings: any) {
    const sensorMode: number =
        trackerSettings.sensorMode !== -1 ? trackerSettings.sensorMode : 2;
    const fpsMode: number =
        trackerSettings.fpsMode !== -1 ? trackerSettings.fpsMode : 50;
    let sensorAutoCorrection: Set<string> = new Set(
        trackerSettings.sensorAutoCorrection
    );

    if (accelerometerEnabled) {
        sensorAutoCorrection.add("accel");
        window.log("Added accel to sensor auto correction");
    }
    if (gyroscopeEnabled) {
        sensorAutoCorrection.add("gyro");
        window.log("Added gyro to sensor auto correction");
    }
    if (magnetometerEnabled) {
        sensorAutoCorrection.add("mag");
        window.log("Added mag to sensor auto correction");
    }

    window.log(
        `Set sensor auto correction for ${deviceID} to: ${Array.from(
            sensorAutoCorrection
        ).join(",")}`
    );

    window.ipc.send("set-tracker-settings", {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection: Array.from(sensorAutoCorrection),
    });
}

window.ipc.on("disconnect", (_event, deviceID) => {
    window.log(`Disconnected from ${deviceID}`);
    document.getElementById(deviceID).remove();
    document.getElementById("tracker-count").textContent = (
        parseInt(document.getElementById("tracker-count").textContent) - 1
    ).toString();

    if (document.getElementById("tracker-count").textContent === "0")
        setStatus("searching");
});

let lastUpdate = Date.now();

window.ipc.on("device-data", (_event: any, arg) => {
    const {
        trackerName,
        rotation,
        gravity,
    }: { trackerName: string; rotation: Rotation; gravity: Gravity } = arg;

    if (!document.getElementById(trackerName)) addDeviceToList(trackerName);

    if (
        !isActive ||
        !document.getElementById("device-list").querySelector(`#${trackerName}`)
    )
        return;
    const now = Date.now();

    // Limit updates to every 50ms
    if (now - lastUpdate < 50) {
        return;
    }

    lastUpdate = now;

    const rotationText = `${rotation.x.toFixed(0)}, ${rotation.y.toFixed(
        0
    )}, ${rotation.z.toFixed(0)}`;
    const gravityText = `${gravity.x.toFixed(0)}, ${gravity.y.toFixed(
        0
    )}, ${gravity.z.toFixed(0)}`;

    document
        .getElementById(trackerName)
        .querySelector("#rotation-data").textContent = rotationText;
    document
        .getElementById(trackerName)
        .querySelector("#acceleration-data").textContent = gravityText;
});

window.ipc.on("device-battery", (_event, arg) => {
    const {
        trackerName,
        batteryRemaining,
        batteryVoltage,
    }: {
        trackerName: string;
        batteryRemaining: number;
        batteryVoltage: number;
    } = arg;
    if (!isActive || !trackerName) return;
    const batteryText: HTMLElement = document
        .getElementById(trackerName)
        .querySelector("#battery");
    if (batteryText === null) return;
    batteryText.textContent = `${batteryRemaining}% (${batteryVoltage}V)`;
    window.log(
        `Battery for ${trackerName}: ${batteryRemaining}% (${batteryVoltage}V)`
    );
});

window.ipc.on("set-status", (_event, msg) => {
    setStatus(msg);
});

// Set version number
window.ipc.on("version", (_event, version) => {
    document.getElementById("version").textContent = version;
    window.log(`Got app version: ${version}`);
});

function addEventListeners() {
    /*
     * Settings event listeners
     */

    document
        .getElementById("censor-serial-switch")
        .addEventListener("change", function () {
            censorSerialNumbers = !censorSerialNumbers;
            window.log(
                `Switched censor serial numbers: ${censorSerialNumbers}`
            );
            window.ipc.send("save-setting", {
                global: {
                    censorSerialNumbers: censorSerialNumbers,
                },
            });

            if (censorSerialNumbers) {
                const devices = document
                    .getElementById("device-list")
                    .querySelectorAll(".card");
                devices.forEach((device) => {
                    const deviceNameElement =
                        device.querySelector("#device-name");
                    const deviceIDElement = device.querySelector("#device-id");
                    const deviceName = deviceNameElement.textContent;
                    const deviceID = deviceIDElement.textContent;

                    if (
                        deviceName.includes("HaritoraX") &&
                        deviceName === device.id
                    ) {
                        deviceNameElement.textContent = "HaritoraX-XXXXXX";
                    }

                    if (deviceID.includes("HaritoraX")) {
                        deviceIDElement.textContent = "HaritoraX-XXXXXX";
                    }

                    if (
                        deviceName.includes("HaritoraXW") &&
                        deviceName === device.id
                    ) {
                        deviceNameElement.textContent = "HaritoraXW-XXXXXX";
                    }

                    if (deviceID.includes("HaritoraXW")) {
                        deviceIDElement.textContent = "HaritoraXW-XXXXXX";
                    }
                });
            } else {
                const devices = document
                    .getElementById("device-list")
                    .querySelectorAll(".card");
                devices.forEach(async (device) => {
                    const settings = await window.ipc.invoke(
                        "get-settings",
                        null
                    );
                    const originalDeviceName =
                        settings.trackers?.[device.id]?.name || device.id;
                    device.querySelector("#device-name").textContent =
                        originalDeviceName;
                    device.querySelector("#device-id").textContent = device.id;
                });
            }
        });

    document
        .getElementById("bluetooth-switch")
        .addEventListener("change", function () {
            bluetoothEnabled = !bluetoothEnabled;
            window.log(`Switched Bluetooth to: ${bluetoothEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    connectionMode: {
                        bluetoothEnabled: bluetoothEnabled,
                    },
                },
            });
        });

    document
        .getElementById("gx-switch")
        .addEventListener("change", function () {
            gxEnabled = !gxEnabled;
            window.log(`Switched GX to: ${gxEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    connectionMode: {
                        gxEnabled: gxEnabled,
                    },
                },
            });
        });

    document
        .getElementById("accelerometer-switch")
        .addEventListener("change", async function () {
            accelerometerEnabled = !accelerometerEnabled;
            window.log(`Switched accelerometer to: ${accelerometerEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        accelerometerEnabled: accelerometerEnabled,
                    },
                },
            });
        });

    document
        .getElementById("gyroscope-switch")
        .addEventListener("change", async function () {
            gyroscopeEnabled = !gyroscopeEnabled;
            window.log(`Switched gyroscope enabled: ${gyroscopeEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        gyroscopeEnabled: gyroscopeEnabled,
                    },
                },
            });
        });

    document
        .getElementById("magnetometer-switch")
        .addEventListener("change", async function () {
            magnetometerEnabled = !magnetometerEnabled;
            window.log(`Switched magnetometer enabled: ${magnetometerEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        magnetometerEnabled: magnetometerEnabled,
                    },
                },
            });
        });

    document.getElementById("com-ports").addEventListener("change", () => {
        const comPorts: HTMLInputElement[] = Array.from(
            document.getElementById("com-ports").querySelectorAll("input")
        );
        const selectedPorts: string[] = [];

        comPorts.forEach((port) => {
            if (port.checked) {
                selectedPorts.push(port.id);
                if (!selectedComPorts.includes(port.id))
                    selectedComPorts.push(port.id);
            } else {
                selectedComPorts.splice(selectedComPorts.indexOf(port.id), 1);
            }
        });

        window.log(`Selected COM ports: ${selectedPorts}`);
        window.ipc.send("save-setting", {
            global: {
                connectionMode: {
                    comPorts: selectedPorts,
                },
            },
        });

        // If four ports are selected, disable the rest
        if (selectedPorts.length >= 4 && !bypassCOMPortLimit) {
            comPorts.forEach((port) => {
                if (!port.checked) {
                    port.disabled = true;
                }
            });
        } else {
            // If less than four ports are selected, enable all ports
            comPorts.forEach((port) => {
                port.disabled = false;
            });
        }
    });

    document
        .getElementById("language-select")
        .addEventListener("change", function () {
            const language: string = (
                document.getElementById("language-select") as HTMLSelectElement
            ).value;
            window.log(`Changed selected language: ${language}`);
            window.changeLanguage(language);
            window.ipc.send("save-setting", {
                global: {
                    language: language,
                },
            });
        });

    document
        .getElementById("log-to-file-switch")
        .addEventListener("change", function () {
            canLogToFile = !canLogToFile;
            window.log(`Switched log to file: ${canLogToFile}`);
            window.ipc.send("set-logging", canLogToFile);
            window.ipc.send("save-setting", {
                global: {
                    debug: {
                        canLogToFile: canLogToFile,
                    },
                },
            });
        });

    document
        .getElementById("skip-slimevr-switch")
        .addEventListener("change", function () {
            skipSlimeVRCheck = !skipSlimeVRCheck;
            window.log(`Switched skip SlimeVR check: ${skipSlimeVRCheck}`);
            window.ipc.send("save-setting", {
                global: {
                    debug: {
                        skipSlimeVRCheck: skipSlimeVRCheck,
                    },
                },
            });
        });

    document
        .getElementById("bypass-com-limit-switch")
        .addEventListener("change", function () {
            bypassCOMPortLimit = !bypassCOMPortLimit;
            window.log(`Switched bypass COM port limit: ${bypassCOMPortLimit}`);
            window.ipc.send("save-setting", {
                global: {
                    debug: {
                        bypassCOMPortLimit: bypassCOMPortLimit,
                    },
                },
            });

            const comPorts: HTMLInputElement[] = Array.from(
                document.getElementById("com-ports").querySelectorAll("input")
            );

            if (bypassCOMPortLimit) {
                comPorts.forEach((port) => {
                    if (bluetoothEnabled && !gxEnabled) {
                        port.disabled = true;
                        return;
                    }
                    port.disabled = false;
                });
            } else {
                if (selectedComPorts.length >= 4) {
                    comPorts.forEach((port) => {
                        if (!port.checked) {
                            port.disabled = true;
                        }
                    });
                }
            }
        });

    document
        .getElementById("debug-tracker-connections-switch")
        .addEventListener("change", function () {
            debugTrackerConnections = !debugTrackerConnections;
            window.log(
                `Switched debug tracker connections: ${debugTrackerConnections}`
            );
            window.ipc.send(
                "set-debug-tracker-connections",
                debugTrackerConnections
            );
            window.ipc.send("save-setting", {
                global: {
                    debug: {
                        debugTrackerConnections: debugTrackerConnections,
                    },
                },
            });
        });

    document
        .getElementById("fps-mode-select")
        .addEventListener("change", async function () {
            fpsMode = parseInt(
                (
                    document.getElementById(
                        "fps-mode-select"
                    ) as HTMLSelectElement
                ).value
            );
            window.log(`Changed FPS mode: ${fpsMode}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        fpsMode: fpsMode,
                    },
                },
            });
        });

    document
        .getElementById("sensor-mode-select")
        .addEventListener("change", async function () {
            sensorMode = parseInt(
                (
                    document.getElementById(
                        "sensor-mode-select"
                    ) as HTMLSelectElement
                ).value
            );
            window.log(`Selected sensor mode: ${sensorMode}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        sensorMode: sensorMode,
                    },
                },
            });
        });
}

window.startConnection = startConnection;
window.stopConnection = stopConnection;
window.openLogsFolder = openLogsFolder;
window.saveSettings = saveSettings;
window.openTrackerSettings = async (deviceID: string) => {
    window.log(`Opening tracker settings for ${deviceID}`);
    window.ipc.send("open-tracker-settings", deviceID);
};

/*
 * TypeScript declarations
 */
