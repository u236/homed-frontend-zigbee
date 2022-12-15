var settings, mqtt, zigbeeData, deviceData, devicesLoaded = false, logicalType = {0: 'coordinator', 1: 'router', 2: 'end device'}, powerSource = {0: 'unknown', 1: 'mains', 3: 'battery', 4: 'dc'};

// startup

window.onload = function()
{
    settings = JSON.parse(localStorage.getItem('settings')) ?? {host: location.hostname, port: '9001', userName: '', password: '', prefix: 'homed', useSSL: false, darkTheme: false};
    mqtt = new Paho.MQTT.Client(settings.host, Number(settings.port), Math.random().toString(36).substring(2, 10));
    
    mqtt.onConnectionLost = onConnectionLost;
    mqtt.onMessageArrived = onMessageArrived;
   
    window.addEventListener('hashchange', function() { showPage(location.hash.slice(1)); });
    window.addEventListener('mousedown', function(event) { if (event.target == document.querySelector('#modal')) closeModal(); });

    document.querySelector('#showDevices').addEventListener('click', function() { showPage('deviceList'); });
    document.querySelector('#showSettings').addEventListener('click', function() { showModal('settings'); });
    document.querySelector('#permitJoin').addEventListener('click', function() { command({action: 'setPermitJoin', enabled: zigbeeData.permitJoin ? false : true}); });
    document.documentElement.setAttribute('theme', settings.darkTheme ? 'dark' : 'light');

    clearPage();
    connect();
};

// mqtt

function onConnectionLost(response)
{
    clearPage('MQTT connection lost: ' + response.errorMessage);
    setTimeout(connect, 2000);
};

function onMessageArrived(message)
{
    if (message.destinationName == settings.prefix + '/status/zigbee')
    {
        zigbeeData = JSON.parse(message.payloadString);
        document.querySelector('#permitJoin').innerHTML = 'PERMIT JOIN ' + (zigbeeData.permitJoin ? '<span class="enabled">ENABLED</span>' : '<span class="disabled">DISABLED</span>');
        document.querySelector('#serviceVersion').innerHTML = zigbeeData.version ?? '?';

        if (devicesLoaded)
        {
            zigbeeData.devices.forEach(device =>
            {
                var row = document.querySelector('tr[data-address="' + device.ieeeAddress + '"], tr[data-name="' + device.name ?? device.ieeeAddress + '"]');

                if (!row)
                    return;
                
                updateLastSeen(row, device.lastSeen);
            });
        }
        else
        {
            showPage('deviceList'); 
            devicesLoaded = true;
        }
    }
    else if (message.destinationName == settings.prefix + '/event/zigbee')
    {
        var payload = JSON.parse(message.payloadString);
        var html = 'Device <b>' + payload.device + '</b> ';

        switch (payload.event)
        {
            case 'deviceJoined':
                showToast(html + 'joined network');
                break;

            case 'deviceLeft':
                showToast(html + 'left network', 'warning');
                break;

            case 'interviewError':
                showToast(html + 'interview error', 'error');
                break;

            case 'interviewTimeout':
                showToast(html + 'interview timed out', 'error');
                break;

            case 'interviewFinished':
                showToast(html + 'interview finished');
                clearPage();
                break;
        }
    }
    else if (message.destinationName.startsWith(settings.prefix + '/device/zigbee/'))
    {
        var list = message.destinationName.split('/');
        var payload = JSON.parse(message.payloadString);
        var row = document.querySelector('tr[data-address="' + list[3] + '"], tr[data-name="' + list[3] + '"]');

        if (!row)
            return;
            
        if (payload.status == 'online')
        {
            row.classList.remove('unavailable');
            row.querySelector('.availability').innerHTML = 'true';
        }
        else
        {
            row.classList.add('unavailable');
            row.querySelector('.availability').innerHTML = 'false';
        }
    }
    else if (message.destinationName.startsWith(settings.prefix + '/fd/zigbee/'))
    {
        var list = message.destinationName.split('/'), payload = JSON.parse(message.payloadString);
        var row = document.querySelector('tr[data-address="' + list[3] + '"], tr[data-name="' + list[3] + '"]');
        var message = document.querySelector('#deviceInfo .message');
        
        if (row)
            row.querySelector('.linkQuality').innerHTML = payload.linkQuality;

        if (message && deviceData && ((deviceData.hasOwnProperty('name') && deviceData.name == list[3]) || (deviceData.hasOwnProperty('ieeeAddress') && deviceData.ieeeAddress == list[3])))
            message.innerHTML = JSON.stringify(payload, null, 4);
    }
}

function connect()
{
    mqtt.connect(
    {
        userName: settings.userName,
        password: settings.password,
        useSSL: settings.useSSL,

        onFailure: function(response)
        {
            clearPage('MQTT connection failed: ' + response.errorMessage);
        },

        onSuccess: function(response)
        {
            mqtt.subscribe(settings.prefix + '/status/zigbee');
            mqtt.subscribe(settings.prefix + '/event/zigbee');
            console.log('MQTT connected');
        }
    });
}

function command(data)
{
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = settings.prefix + '/command/zigbee';
    mqtt.send(message);
}

// page

function showPage(name)
{
    var container = document.querySelector('.content .container');

    if (!zigbeeData)
        return;

    switch (name)
    {
        case 'deviceInfo':
            
            fetch('html/deviceInfo.html').then(response => response.text()).then(html =>
            {
                container.innerHTML = html;
                container.querySelector('.rename').addEventListener('click', function() { showModal('deviceRename'); });
                container.querySelector('.remove').addEventListener('click', function() { showModal('deviceRemove'); });

                for (var key in deviceData)
                {
                    var cell = document.querySelector('#deviceInfo .' + key);

                    if (!cell)
                        continue;

                    cell.innerHTML = parseValue(key, deviceData[key]);
                }

                if (!deviceData.logicalType)
                {
                    container.querySelector('.buttons').style.display = 'none';
                    container.querySelector('.message').style.display = 'none';
                }
            });
            
            break;

        default:
        
            fetch('html/deviceList.html').then(response => response.text()).then(html =>
            {
                container.innerHTML = html;
                
                zigbeeData.devices.forEach(device =>
                {
                    if (!device.hasOwnProperty('removed'))
                    {
                        var row = container.querySelector('#deviceList tbody').insertRow();
                        var cell = [];

                        row.addEventListener('click', function() { deviceData = device; showPage('deviceInfo'); });
                        row.dataset.address = device.ieeeAddress;
                        row.dataset.name = device.name ?? device.ieeeAddress;

                        for (var i = 0; i < 8; i++)
                        {
                            cell[i] = row.insertCell();
                    
                            if (i < 4)
                                continue;
                    
                            cell[i].classList.add('right');
                        }
                    
                        cell[0].innerHTML = device.name ?? device.ieeeAddress;
                        cell[1].innerHTML = device.manufacturerName ?? '-';
                        cell[2].innerHTML = device.modelName ?? '-';
                        cell[3].innerHTML = logicalType[device.logicalType];
                        cell[4].innerHTML = device.supported ?? '-';
                        cell[5].innerHTML = '-';
                        cell[6].innerHTML = device.linkQuality ?? '-';
                        cell[7].innerHTML = '-';
                    
                        cell[5].classList.add('availability');
                        cell[6].classList.add('linkQuality');
                        cell[7].classList.add('lastSeen');
                    
                        updateLastSeen(row, device.lastSeen);
                    }
                });

                mqtt.subscribe(settings.prefix + '/device/zigbee/#');
                mqtt.subscribe(settings.prefix + '/fd/zigbee/#');
            });

            break;
    }
    
    location.hash = name;
}

function clearPage(error = null)
{
    var container = document.querySelector('.content .container');

    fetch('html/loader.html').then(response => response.text()).then(html =>
    {
        container.innerHTML = html;
        
        if (error)
        {
            container.querySelector('.error').innerHTML = error;
            console.log(error);
        }

        closeModal();
        devicesLoaded = false;
    });
}

// modal

function showModal(name)
{
    var modal = document.querySelector('#modal');

    switch (name)
    {
        case 'settings':
            
            fetch('html/settings.html').then(response => response.text()).then(html =>
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
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });
                modal.style.display = 'block';
               
            });
            
            break;

        case 'deviceRename':
            
            fetch('html/deviceRename.html').then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;
                modal.querySelector('.title').innerHTML = 'Renaming ' + (deviceData.name ?? deviceData.ieeeAddress);
                modal.querySelector('input[name="name"]').value = deviceData.name ?? deviceData.ieeeAddress;
                modal.querySelector('.rename').addEventListener('click', function() { renameDevice(deviceData.ieeeAddress, modal.querySelector('input[name="name"]').value); });
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });
                modal.style.display = 'block';
            });

            break;

        case 'deviceRemove':
            
            fetch('html/deviceRemove.html').then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;
                modal.querySelector('.title').innerHTML = 'Remove ' + (deviceData.name ?? deviceData.ieeeAddress) + '?';
                modal.querySelector('.graceful').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, false); });
                modal.querySelector('.force').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, true); });
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });
                modal.style.display = 'block';
            });

            break;

        default:
            return;
    }

}

function closeModal()
{
    document.querySelector('#modal').style.display = 'none';
}

// toast

function showToast(message, style = 'default')
{
    var item = document.createElement('div');

    item.innerHTML = '<div class="message">' + message + '</div>';
    item.classList.add('item', 'fade-in', style);
    item.addEventListener('click', function() { closeToast(this); });

    document.querySelector('#toast').appendChild(item);
    setTimeout(closeToast, 1000, item);
}

function closeToast(item)
{
    var toast = document.querySelector('#toast');

    if (toast.contains(item))
    {
        setTimeout(function() { toast.removeChild(item); }, 200);
        item.classList.add('fade-out');
    }
}

// action

function renameDevice(ieeeAddress, name)
{
    clearPage();
    command({action: 'setDeviceName', device: ieeeAddress, name: name});
}

function removeDevice(ieeeAddress, force)
{
    clearPage();
    command({action: 'removeDevice', device: ieeeAddress, force: force});
}

// misc

function formData(form)
{
    var data = {};
    Array.from(form).forEach((input) => { data[input.name] =  input.type == 'checkbox' ? input.checked : input.value; });
    return data;
}

function parseValue(key, value)
{
    switch (key)
    {
        case 'logicalType': return logicalType[value];
        case 'powerSource': return powerSource[value];
        case 'networkAddress':
        case 'manufacturerCode':
            return '0x' + ('0000' + value.toString(16).toUpperCase()).slice(-4);
        
        default: return value;
    }
}

function updateLastSeen(row, lastSeen)
{
    var cell = row.querySelector('.lastSeen');
    var interval = Date.now() / 1000 - lastSeen;

    switch (true)
    {
        case interval >= 86400: cell.innerHTML = Math.round(interval / 86400) + ' day'; break;
        case interval >= 3600:  cell.innerHTML = Math.round(interval / 3600) + ' hrs'; break;
        case interval >= 60:    cell.innerHTML = Math.round(interval / 60) + ' min'; break;
        default:                cell.innerHTML = 'now'; break;
    }
}