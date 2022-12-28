var settings, mqtt, zigbeeData, deviceData, devicesLoaded = false, logicalType = ['coordinator', 'router', 'end device'];

// startup

window.onload = function()
{
    settings = JSON.parse(localStorage.getItem('settings')) ?? {host: location.hostname, port: '9001', userName: '', password: '', path: '/mqtt', prefix: 'homed', useSSL: false, darkTheme: false};
    mqtt = new Paho.MQTT.Client(settings.host, Number(settings.port), settings.path, Math.random().toString(36).substring(2, 10));

    mqtt.onConnectionLost = onConnectionLost;
    mqtt.onMessageArrived = onMessageArrived;

    window.addEventListener('hashchange', function() { showPage(location.hash.slice(1)); });
    window.addEventListener('mousedown', function(event) { if (event.target == document.querySelector('#modal')) closeModal(); });

    document.documentElement.setAttribute('theme', settings.darkTheme ? 'dark' : 'light');

    document.querySelector('#showDevices').addEventListener('click', function() { showPage('deviceList'); });
    document.querySelector('#showMap').addEventListener('click', function() { showPage('networkMap'); });
    document.querySelector('#showSettings').addEventListener('click', function() { showModal('settings'); });
    document.querySelector('#permitJoin').addEventListener('click', function() { command({action: 'setPermitJoin', enabled: zigbeeData.permitJoin ? false : true}); });

    document.querySelector('#toggleTheme').innerHTML = 'DARK THEME ' + (settings.darkTheme ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>');
    document.querySelector('#toggleTheme').addEventListener('click', function()
    {
        settings.darkTheme = settings.darkTheme ? false : true;
        localStorage.setItem('settings', JSON.stringify(settings));
        location.reload();
    });

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

        document.querySelector('#permitJoin').innerHTML = (zigbeeData.permitJoin ? '<i class="icon-enable warning"></i>' : '<i class="icon-enable shade"></i>') + ' PERMIT JOIN';
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

            case 'deviceNameDuplicate':
                showToast(html + 'rename failed, name already in use', 'error');
                break;

            case 'deviceUpdated':
                showToast(html + 'successfully updated');
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
        var payload = message.payloadString ? JSON.parse(message.payloadString) : null;
        var row = document.querySelector('tr[data-address="' + list[3] + '"], tr[data-name="' + list[3] + '"]');

        if (!payload || !row)
            return;

        if (payload.status == 'online')
        {
            row.classList.remove('unavailable');
            row.querySelector('.availability').innerHTML = '<i class="icon-true success"></i>';
        }
        else
        {
            row.classList.add('unavailable');
            row.querySelector('.availability').innerHTML = '<i class="icon-false error"></i>';
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

            fetch('html/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                container.innerHTML = html;
                container.querySelector('.rename').addEventListener('click', function() { showModal('deviceRename'); });
                container.querySelector('.remove').addEventListener('click', function() { showModal('deviceRemove'); });
                container.querySelector('.data').addEventListener('click', function() { showModal('deviceData'); });

                for (var key in deviceData)
                {
                    var cell = document.querySelector('#deviceInfo .' + key);

                    if (!cell)
                        continue;

                    cell.innerHTML = parseValue(key, deviceData[key]);
                }

                if (!deviceData.logicalType)
                {
                    container.querySelector('.rename').style.display = 'none';
                    container.querySelector('.remove').style.display = 'none';
                    container.querySelector('.message').style.display = 'none';
                }
            });

            break;

        case 'networkMap':

            fetch('html/networkMap.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                var map, width, height, link, text, node, routerLinks = false;
                var data = {nodes: [], links: []};
                var drag = d3.drag();
                var simulation = d3.forceSimulation();
                var symbol = [d3.symbolStar, d3.symbolTriangle, d3.symbolCircle];

                container.innerHTML = html;
                container.querySelector('input[name="routerLinks"]').addEventListener('change', function() { routerLinks = this.checked; simulation.restart(); });

                map = d3.select('#map');
                width = parseInt(map.style('width'));
                height = parseInt(map.style('height'));

                zigbeeData.devices.forEach(device =>
                {
                    if (device.hasOwnProperty('removed'))
                        return;

                    data.nodes.push({id: device.networkAddress, name: device.name ?? device.ieeeAddress, type: device.logicalType});

                    if (!device.hasOwnProperty('neighbors'))
                        return;

                    device.neighbors.forEach(neighbor =>
                    {
                        if (!zigbeeData.devices.find(item => { return item.networkAddress == neighbor.networkAddress; }))
                            return;

                        data.links.push({linkQuality: neighbor.linkQuality, source: neighbor.networkAddress, target: device.networkAddress});
                    });
                });

                link = map.selectAll('.link').data(data.links).enter().append('path').attr('class', 'link').attr('id', function(d, i) { return 'link' + i; });
                text = map.selectAll('.text').data(data.links).enter().append('text').attr('class', 'text').attr('dy', -1);
                text.append('textPath').style('text-anchor', 'middle').attr('startOffset', '50%').attr('href', function(d, i) { return '#link' + i; }).text(function(d) { return d.linkQuality; });
                
                node = map.append('g').selectAll('g').data(data.nodes).enter().append('g');
                node.append('path').attr('class', 'node').attr('d', d3.symbol().size(100).type(function(d) { return symbol[d.type ?? 2]; }));
                node.append('text').text(function(d) { return d.name; }).attr('x', 12).attr('y', 3);

                node.select('path').on('mouseenter', function(d)
                {
                    text.attr('display', 'none').filter(i => i.source.id == d.id || i.target.id == d.id).attr('display', 'block');
                    link.attr('display', 'none').filter(i => i.source.id == d.id || i.target.id == d.id).attr('display', 'block').classed('highlight', true);
                });

                node.select('path').on('mouseleave', function() { text.attr('display', 'block'); link.attr('display', 'block').classed('highlight', false); });
                node.select('text').on('click', function(d) { deviceData = zigbeeData.devices.filter(i => i.networkAddress == d.id)[0]; showPage('deviceInfo'); });

                drag.on('start', function(d) { if (!d3.event.active) simulation.alphaTarget(0.1).restart(); d.fx = d.x; d.fy = d.y; });
                drag.on('drag', function(d) { d.fx = d3.event.x; d.fy = d3.event.y; });
                drag.on('end', function(d) { if (!d3.event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });

                simulation.force('center', d3.forceCenter(width / 2, height / 2));
                simulation.force('charge', d3.forceManyBody().strength(-2000));
                simulation.force('radial', d3.forceRadial(function(d) { return d.type * 100; }, width / 2, height / 2).strength(1));
                simulation.force('link', d3.forceLink().id(function(d) { return d.id; }));

                simulation.nodes(data.nodes).on('tick', function()
                {
                    link.attr('d', function(d) { if (routerLinks || d.source.type != d.target.type) return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + d.target.x + ' ' + d.target.y; });
                    node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
                });

                simulation.force('link').links(data.links);
                drag(node);
            });

            break;

        default:

            fetch('html/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                container.innerHTML = html;

                zigbeeData.devices.forEach(device =>
                {
                    if (!device.hasOwnProperty('removed'))
                    {
                        var row = container.querySelector('#deviceList tbody').insertRow(device.logicalType ? -1 : 0);

                        row.addEventListener('click', function() { deviceData = device; console.log(deviceData); showPage('deviceInfo'); });
                        row.dataset.address = device.ieeeAddress;
                        row.dataset.name = device.name ?? device.ieeeAddress;

                        for (var i = 0; i < 9; i++)
                        {
                            var cell = row.insertCell();

                            switch (i)
                            {
                                case 0: cell.innerHTML = device.name ?? device.ieeeAddress; break;
                                case 1: cell.innerHTML = device.manufacturerName ?? '-'; break;
                                case 2: cell.innerHTML = device.modelName ?? '-'; break;
                                case 3: cell.innerHTML = logicalType[device.logicalType]; break;
                                case 4: cell.innerHTML = parseValue('powerSource', device.powerSource); cell.classList.add('center'); break;
                                case 5: cell.innerHTML = parseValue('supported', device.supported); cell.classList.add('center'); break;
                                case 6: cell.innerHTML = '-'; cell.classList.add('availability', 'center'); break;
                                case 7: cell.innerHTML = device.linkQuality ?? '-'; cell.classList.add('linkQuality', 'right'); break;
                                case 8: cell.innerHTML = '-'; cell.classList.add('lastSeen', 'right'); break;
                            }
                        }

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

function clearPage(warning = null)
{
    var container = document.querySelector('.content .container');

    fetch('html/loader.html?' + Date.now()).then(response => response.text()).then(html =>
    {
        container.innerHTML = html;

        if (warning)
        {
            container.querySelector('.warning').innerHTML = warning;
            console.log(warning);
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

            fetch('html/settings.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;
                modal.querySelector('input[name="host"]').value = settings.host ?? location.hostname;
                modal.querySelector('input[name="port"]').value = settings.port ?? '9001';
                modal.querySelector('input[name="userName"]').value = settings.userName ?? '';
                modal.querySelector('input[name="password"]').value = settings.password ?? '';
                modal.querySelector('input[name="path"]').value = settings.path ?? '/mqtt';
                modal.querySelector('input[name="prefix"]').value = settings.prefix ?? 'homed';
                modal.querySelector('input[name="useSSL"]').checked = settings.useSSL ?? false;
                modal.querySelector('input[name="darkTheme"]').checked = settings.darkTheme ?? false;
                modal.querySelector('.save').addEventListener('click', function() { localStorage.setItem('settings', JSON.stringify(formData(modal.querySelectorAll('form')[0]))); location.reload(); });
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });
                modal.style.display = 'block';

            });

            break;

        case 'deviceRename':

            fetch('html/deviceRename.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;
                modal.querySelector('.title').innerHTML = 'Renaming "' + (deviceData.name ?? deviceData.ieeeAddress) + '"';
                modal.querySelector('input[name="name"]').value = deviceData.name ?? deviceData.ieeeAddress;
                modal.querySelector('.rename').addEventListener('click', function() { renameDevice(deviceData.ieeeAddress, modal.querySelector('input[name="name"]').value); });
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });
                modal.style.display = 'block';
            });

            break;

        case 'deviceRemove':

            fetch('html/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;
                modal.querySelector('.title').innerHTML = 'Remove "' + (deviceData.name ?? deviceData.ieeeAddress) + '"?';
                modal.querySelector('.graceful').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, false); });
                modal.querySelector('.force').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, true); });
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });
                modal.style.display = 'block';
            });

            break;

        case 'deviceData':

            fetch('html/deviceData.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;
                modal.querySelector('.title').innerHTML = (deviceData.name ?? deviceData.ieeeAddress);
                modal.querySelector('.json').innerHTML = JSON.stringify(deviceData, null, 4);
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

function showToast(message, style = 'success')
{
    var item = document.createElement('div');

    item.innerHTML = '<div class="message">' + message + '</div>';
    item.classList.add('item', 'fade-in', style);
    item.addEventListener('click', function() { closeToast(this); });

    document.querySelector('#toast').appendChild(item);
    setTimeout(closeToast, 5000, item);
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
        case 'powerSource': return value !== undefined ? '<i class="icon-' + (value != 0 && value != 3 ? 'plug' : 'battery') + '"></i>' : '-';

        case 'networkAddress':
        case 'manufacturerCode':
            return '0x' + ('0000' + value.toString(16).toUpperCase()).slice(-4);

        case 'supported':
        case 'interviewFinished':
            return value !== undefined ? '<i class="icon-' + (value ? 'true' : 'false') + ' ' + (value ? 'success' : 'warning') + '"></i>' : '-';

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
