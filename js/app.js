var mqtt = new Paho.MQTT.Client(location.hostname, 9001, Math.random().toString(36).substring(2, 10));

var options =
{
    useSSL: false,
    userName: '',
    password: '',
    onSuccess: mqttOnSuccess,
    onFailure: mqttOnFailure
};

var prefix = 'homed';
var devicesLoaded = false;
var zigbee, modalData;

//

mqtt.connect(options);

mqtt.onConnectionLost = function (response)
{
    console.log('MQTT connection lost: ' + response.errorMessage);
    setTimeout(mqtt.connect(options), 1000);
};

mqtt.onMessageArrived = function (message)
{
    if (message.destinationName.startsWith(prefix + '/fd/zigbee/'))
    {
        var list = message.destinationName.split('/');

        if (modalData && ((modalData.hasOwnProperty('name') && modalData.name == list[3]) || (modalData.hasOwnProperty('ieeeAddress') && modalData.ieeeAddress == list[3])))
        {
            var payload = JSON.parse(message.payloadString);
            document.querySelector('#modal .message').innerHTML = JSON.stringify(payload, null, 4);
        }
    }
    else if (message.destinationName == prefix + '/event/zigbee')
    {
        var payload = JSON.parse(message.payloadString);
        var device = 'Device <b>' + payload.device + '</b> ';

        switch (payload.event)
        {
            case 'deviceJoined':
                appendToast(device + 'joined network');
                break;

            case 'deviceLeft':
                appendToast(device + 'left network', 'warning');
                break;

            case 'interviewError':
                appendToast(device + 'interview error', 'error');
                break;

            case 'interviewTimeout':
                appendToast(device + 'interview timed out', 'error');
                break;

            case 'interviewFinished':
                appendToast(device + 'interview finished');
                clearDeviceTable();
                break;
        }
       
    }
    else if (message.destinationName == prefix + '/status/zigbee')
    {
        zigbee = JSON.parse(message.payloadString);
        document.querySelector('#permitJoin').innerHTML = 'PERMIT JOIN ' + (zigbee.permitJoin ? '<span class="enabled">ENABLED</span>' : '<span class="disabled">DISABLED</span>');

        if (!devicesLoaded)
        {
            document.querySelector('#deviceTable tbody').innerHTML = '';
            zigbee.devices.forEach(device => { if (!device.hasOwnProperty('removed')) appendDeviceTable(device) });
            devicesLoaded = true;
        }
    }
}

function mqttOnSuccess()
{
    console.log('MQTT connected');
    mqtt.subscribe(prefix + '/fd/zigbee/#');
    mqtt.subscribe(prefix + '/event/zigbee');
    mqtt.subscribe(prefix + '/status/zigbee');
}

function mqttOnFailure()
{
    console.log('MQTT connection failed');
    setTimeout(mqtt.connect(options), 1000);
}

function mqttPublishCommand(data)
{
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = prefix + '/command/zigbee';
    mqtt.send(message);
}

//

function appendDeviceTable(device)
{
    var logicalType = ['coordinator', 'router', 'end device'], lastSeen = '-';
    var row = document.querySelector('#deviceTable tbody').insertRow(), cell = [];

    if (device.hasOwnProperty('lastSeen'))
    {
        var date = new Date(device.lastSeen * 1000);
        lastSeen = ('0' + date.getDay()).slice(-2) + '.' + ('0' + date.getMonth()).slice(-2) + ', ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
    }

    row.addEventListener('click', function() { modalData = device; showDeviceInfo(); });
    row.style.cursor = 'pointer';

    for (var i = 0; i < 6; i++) cell[i] = row.insertCell();

    cell[0].innerHTML = device.name ?? device.ieeeAddress;
    cell[1].innerHTML = device.manufacturerName ?? '-';
    cell[2].innerHTML = device.modelName ?? '-';
    cell[3].innerHTML = logicalType[device.logicalType];
    cell[4].innerHTML = '0x' + ('0000' + device.networkAddress.toString(16).toUpperCase()).slice(-4);
    cell[5].innerHTML = lastSeen;
}

function clearDeviceTable()
{
    document.querySelector('#deviceTable tbody').innerHTML = '<tr><td colspan="6" align="center"><div class="loader"></div></td></tr>';
    devicesLoaded = false;
}

//

function showDeviceInfo()
{
    var modal = document.querySelector('#modal');

    fetch('deviceInfo.html').then(response => response.text()).then(html =>
    {
        modal.querySelector('.data').innerHTML = html;
        modal.querySelector('.title').innerHTML = modalData.name ?? modalData.ieeeAddress;
        modal.querySelector('.message').innerHTML = 'last message will appear here';
        modal.querySelector('.info').innerHTML = JSON.stringify(modalData, null, 4);
        modal.querySelector('.rename').addEventListener('click', function() { showDeviceRename() });
        modal.querySelector('.remove').addEventListener('click', function() { showDeviceRemove() });
        modal.querySelector('.close').addEventListener('click', function() { modal.style.display = 'none' });
        modal.style.display = 'block';
    });
}

function showDeviceRename()
{
    var modal = document.querySelector('#modal');

    fetch('deviceRename.html').then(response => response.text()).then(html =>
    {
        modal.querySelector('.data').innerHTML = html;
        modal.querySelector('.title').innerHTML = 'Renaming ' + (modalData.name ?? modalData.ieeeAddress);
        modal.querySelector('.input').value = modalData.name ?? modalData.ieeeAddress;
        modal.querySelector('.rename').addEventListener('click', function() { renameDevice(modalData.ieeeAddress, modal.querySelector('.input').value) });
        modal.querySelector('.cancel').addEventListener('click', function() { showDeviceInfo() });
        modal.style.display = 'block';
    });
}

function showDeviceRemove()
{
    var modal = document.querySelector('#modal');

    fetch('deviceRemove.html').then(response => response.text()).then(html =>
    {
        modal.querySelector('.data').innerHTML = html;
        modal.querySelector('.title').innerHTML = 'Remove ' + (modalData.name ?? modalData.ieeeAddress) + '?';
        modal.querySelector('.graceful').addEventListener('click', function() { removeDevice(modalData.ieeeAddress, false); });
        modal.querySelector('.force').addEventListener('click', function() { removeDevice(modalData.ieeeAddress, true); });
        modal.querySelector('.cancel').addEventListener('click', function() { showDeviceInfo() });
        modal.style.display = 'block';
    });
}

//

function appendToast(message, style = 'default')
{
    var item = document.createElement('div');

    item.innerHTML = '<div class="message">' + message + '</div>';
    item.classList.add('item', 'fade-in', style);
    item.addEventListener('click', function() { closeToast(this) });

    setTimeout(function() { closeToast(item); }, 5000);
    document.querySelector("#toast").appendChild(item);
}

function closeToast(item)
{
    var toast = document.querySelector("#toast");

    if (toast.contains(item))
    {
        setTimeout(function() { toast.removeChild(item); }, 250);
        item.classList.add('fade-out');
    }
}

//

function renameDevice(ieeeAddress, name)
{
    clearDeviceTable();
    mqttPublishCommand({action: 'setDeviceName', device: ieeeAddress, name: name});
    document.querySelector('#modal').style.display = 'none';
}

function removeDevice(ieeeAddress, force)
{
    clearDeviceTable();
    mqttPublishCommand({action: 'removeDevice', device: ieeeAddress, force: force});
    document.querySelector('#modal').style.display = 'none';
}

//

document.querySelector('#permitJoin').addEventListener('click', function()
{
    mqttPublishCommand({action: 'setPermitJoin', enabled: zigbee.permitJoin ? false : true});
});
