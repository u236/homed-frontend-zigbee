var modal, settings, options, mqtt, zigbeeData, deviceData, devicesLoaded = false;

window.onload = function()
{
    modal = document.querySelector('#modal');
    settings = JSON.parse(localStorage.getItem('settings')) ?? {host: location.hostname, port: '9001', userName: '', password: '', prefix: 'homed', useSSL: false, darkTheme: false};
    options = {onSuccess: onSuccess, onFailure: onFailure, userName: settings.userName, password: settings.password, useSSL: settings.useSSL};
    mqtt = new Paho.MQTT.Client(settings.host, Number(settings.port), Math.random().toString(36).substring(2, 10));

    mqtt.onConnectionLost = onConnectionLost;
    mqtt.onMessageArrived = onMessageArrived;
    mqtt.connect(options);

    window.addEventListener('mousedown', function() { if (event.target == modal) modal.style.display = 'none'; });
    document.querySelector('#showSettings').addEventListener('click', function() { showSettings(); });
    document.querySelector('#permitJoin').addEventListener('click', function() { publishCommand({action: 'setPermitJoin', enabled: zigbeeData.permitJoin ? false : true}); });
    document.documentElement.setAttribute('theme', settings.darkTheme ? 'dark' : 'light');
};

function formData(form)
{
    var data = {};
    Array.from(form).forEach((input) => { data[input.name] =  input.type == 'checkbox' ? input.checked : input.value; });
    return data;
}

//

function onSuccess()
{
    console.log('MQTT connected');
    mqtt.subscribe(settings.prefix + '/fd/zigbee/#');
    mqtt.subscribe(settings.prefix + '/event/zigbee');
    mqtt.subscribe(settings.prefix + '/status/zigbee');
}

function onFailure()
{
    console.log('MQTT connection failed');
    setTimeout(mqtt.connect(options), 1000);
}

function onConnectionLost(response)
{
    console.log('MQTT connection lost: ' + response.errorMessage);
    setTimeout(mqtt.connect(options), 1000);
};


function onMessageArrived(message)
{
    if (message.destinationName.startsWith(settings.prefix + '/fd/zigbee/'))
    {
        var list = message.destinationName.split('/');

        if (deviceData && ((deviceData.hasOwnProperty('name') && deviceData.name == list[3]) || (deviceData.hasOwnProperty('ieeeAddress') && deviceData.ieeeAddress == list[3])))
        {
            var payload = JSON.parse(message.payloadString);
            document.querySelector('#modal .message').innerHTML = JSON.stringify(payload, null, 4);
        }
    }
    else if (message.destinationName == settings.prefix + '/event/zigbee')
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
    else if (message.destinationName == settings.prefix + '/status/zigbee')
    {
        zigbeeData = JSON.parse(message.payloadString);
        document.querySelector('#permitJoin').innerHTML = 'PERMIT JOIN ' + (zigbeeData.permitJoin ? '<span class="enabled">ENABLED</span>' : '<span class="disabled">DISABLED</span>');
        document.querySelector('#serviceVersion').innerHTML = zigbeeData.version ?? '?';

        if (!devicesLoaded)
        {
            document.querySelector('#deviceTable tbody').innerHTML = '';
            zigbeeData.devices.forEach(device => { if (!device.hasOwnProperty('removed') && device.logicalType) appendDeviceTable(device); });
            devicesLoaded = true;
        }
    }
}

function publishCommand(data)
{
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = settings.prefix + '/command/zigbee';
    mqtt.send(message);
}

//

function appendDeviceTable(device)
{
    var logicalType = ['coordinator', 'router', 'end device'], lastSeen = '-';
    var row = document.querySelector('#deviceTable tbody').insertRow(), cell = [];

    if (device.hasOwnProperty('lastSeen'))
    {
       var interval = Date.now() / 1000 - device.lastSeen;

            if (interval > 86400)
                lastSeen = Math.round(interval / 86400) + ' days';
            else if (interval > 3600)
                lastSeen = Math.round(interval / 3600) + ' hours';
            else if (interval > 60)
                lastSeen = Math.round(interval / 60) + ' minutes';
            else
                lastSeen = Math.round(interval) + ' seconds';
    }

    row.addEventListener('click', function() { deviceData = device; showDeviceInfo(); });
    row.style.cursor = 'pointer';

    for (var i = 0; i < 7; i++)
    {
        cell[i] = row.insertCell();

        if (i < 4)
            continue;

        cell[i].classList.add('alignRight');
    }

    cell[0].innerHTML = device.name ?? device.ieeeAddress;
    cell[1].innerHTML = device.manufacturerName ?? '-';
    cell[2].innerHTML = device.modelName ?? '-';
    cell[3].innerHTML = logicalType[device.logicalType];
    cell[4].innerHTML = device.linkQuality ?? '-';
    cell[5].innerHTML = device.supported ?? '-';
    cell[6].innerHTML = lastSeen;
}

function clearDeviceTable()
{
    document.querySelector('#deviceTable tbody').innerHTML = '<tr><td colspan="7" align="center"><div class="loader"></div></td></tr>';
    devicesLoaded = false;
}

//

function showSettings()
{
    fetch('settings.html').then(response => response.text()).then(html =>
    {
        modal.querySelector('.data').innerHTML = html;
        modal.querySelector('input[name="host"]').value = settings.host ?? location.hostname;
        modal.querySelector('input[name="port"]').value = settings.port ?? '9001';
        modal.querySelector('input[name="userName"]').value = settings.userName ?? '';
        modal.querySelector('input[name="password"]').value = settings.password ?? '';
        modal.querySelector('input[name="prefix"]').value = settings.prefix ?? 'homed';
        modal.querySelector('input[name="useSSL"]').checked = settings.useSSL ?? false;
        modal.querySelector('input[name="darkTheme"]').checked = settings.darkTheme ?? false;
        modal.querySelector('.save').addEventListener('click', function() { localStorage.setItem('settings', JSON.stringify(formData(modal.querySelectorAll('form')[0]))); location.reload(); });
        modal.querySelector('.close').addEventListener('click', function() { modal.style.display = 'none'; });
        modal.style.display = 'block';
    });
}

function showDeviceInfo()
{
    fetch('deviceInfo.html').then(response => response.text()).then(html =>
    {
        modal.querySelector('.data').innerHTML = html;
        modal.querySelector('.title').innerHTML = deviceData.name ?? deviceData.ieeeAddress;
        modal.querySelector('.message').innerHTML = 'last message will appear here';
        modal.querySelector('.info').innerHTML = JSON.stringify(deviceData, null, 4);
        modal.querySelector('.rename').addEventListener('click', function() { showDeviceRename(); });
        modal.querySelector('.remove').addEventListener('click', function() { showDeviceRemove(); });
        modal.querySelector('.close').addEventListener('click', function() { modal.style.display = 'none'; });
        modal.style.display = 'block';
    });
}

function showDeviceRename()
{
    fetch('deviceRename.html').then(response => response.text()).then(html =>
    {
        modal.querySelector('.data').innerHTML = html;
        modal.querySelector('.title').innerHTML = 'Renaming ' + (deviceData.name ?? deviceData.ieeeAddress);
        modal.querySelector('input[name="name"]').value = deviceData.name ?? deviceData.ieeeAddress;
        modal.querySelector('.rename').addEventListener('click', function() { renameDevice(deviceData.ieeeAddress, modal.querySelector('input[name="name"]').value); });
        modal.querySelector('.cancel').addEventListener('click', function() { showDeviceInfo(); });
        modal.style.display = 'block';
    });
}

function showDeviceRemove()
{
    fetch('deviceRemove.html').then(response => response.text()).then(html =>
    {
        modal.querySelector('.data').innerHTML = html;
        modal.querySelector('.title').innerHTML = 'Remove ' + (deviceData.name ?? deviceData.ieeeAddress) + '?';
        modal.querySelector('.graceful').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, false); });
        modal.querySelector('.force').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, true); });
        modal.querySelector('.cancel').addEventListener('click', function() { showDeviceInfo(); });
        modal.style.display = 'block';
    });
}

//

function appendToast(message, style = 'default')
{
    var item = document.createElement('div');

    item.innerHTML = '<div class="message">' + message + '</div>';
    item.classList.add('item', 'fade-in', style);
    item.addEventListener('click', function() { closeToast(this); });

    setTimeout(function() { closeToast(item); }, 5000);
    document.querySelector('#toast').appendChild(item);
}

function closeToast(item)
{
    var toast = document.querySelector('#toast');

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
    publishCommand({action: 'setDeviceName', device: ieeeAddress, name: name});
    document.querySelector('#modal').style.display = 'none';
}

function removeDevice(ieeeAddress, force)
{
    clearDeviceTable();
    publishCommand({action: 'removeDevice', device: ieeeAddress, force: force});
    document.querySelector('#modal').style.display = 'none';
}
