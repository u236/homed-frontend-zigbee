var colorPicker;

function exposeTitle(name, suffix)
{
    var title = name.replace(/([A-Z])/g, ' $1').toLowerCase().split(' ');

    switch (title[0])
    {
        case 'co2':  title[0] = 'CO2'; break;
        case 'eco2': title[0] = 'eCO2'; break;
        case 'voc':  title[0] = 'VOC'; break;
        default:     title[0] = title[0].charAt(0).toUpperCase() + title[0].slice(1).toLowerCase(); break;
    }

    if (['p1', 'p2', 'p3', 'p4'].includes(title[1]))
        title[1] = title[1].toUpperCase();

    return title.join(' ') + (suffix != 'common' ? ' ' + suffix : '');
}

function exposeUnit(name)
{
    var unit;

    switch (name)
    {
        case 'co2':            unit = 'ppm'; break;
        case 'current':        unit = 'A'; break;
        case 'energy':         unit = 'kW·h'; break;
        case 'illuminance':    unit = 'lux';  break;
        case 'power':          unit = 'W'; break;
        case 'pressure':       unit = 'kPa'; break;
        case 'targetDistance': unit = 'm'; break;
        case 'temperature':    unit = '°C'; break;
        case 'voc':            unit = 'ppb'; break;
        case 'voltage':        unit = 'V'; break;

        case 'battery':
        case 'humidity':
        case 'moisture':
            unit = '%';
            break;
    }

    return unit ? ' ' + unit : '';
}

function addExpose(endpoint, expose, options = {}, endpoints = undefined)
{
    var suffix = isNaN(endpoint) ? '' : '-' + endpoint;
    var control = true;
    var list = [];

    switch(expose)
    {
        case 'cover':
            list = ['cover', 'position'];
            break;

        case 'light':
            list = ['switch'].concat(options.light);
            break;

        case 'thermostat':

            list = ['temperature', 'heating'];
            options = options.thermostat ?? {};

            if (options)
                Object.keys(options).forEach(item => { if (item != 'status') list.push(item); else list.unshift('switch'); } );

            break;

        case 'thermostatProgram':

            var types = ["weekday", "saturday", "sunday"];
            var option = options.thermostat.targetTemperature ?? {};

            if (isNaN(option.min) || isNaN(option.max))
                break;

            for (var i = 0; i < 12; i++)
            {
                var item = types[parseInt(i / 4)] + 'P' + parseInt(i % 4 + 1);
                list.push(item + 'Time');
                list.push(item + 'Temperature');
                options[item + 'Temperature'] = option;
            }

            break;

        default:
            list.push(expose);
            break;
    }

    list.forEach(name =>
    {
        var row = document.querySelector('.deviceInfo table.exposes').insertRow();
        var titleCell = row.insertCell();
        var valueCell = row.insertCell();
        var controlCell = row.insertCell();

        row.dataset.name = name + suffix;
        titleCell.innerHTML =  exposeTitle(name, options.name ?? endpoint);
        valueCell.innerHTML = '<span class="shade"><i>unknown</i></span>';
        valueCell.classList.add('value');
        controlCell.classList.add('control');

        if (options[name] == 'raw')
            row.dataset.option = 'raw';

        switch (name)
        {
            case 'color':
                colorPicker = new iro.ColorPicker(controlCell, {layout: [{component: iro.ui.Wheel}], width: 150});
                colorPicker.on("input:end", function() { sendData(endpoint, {color: [colorPicker.color.rgb.r, colorPicker.color.rgb.g, colorPicker.color.rgb.b]}); });
                break;

            case 'colorTemperature':
                var option = options.colorTemperature ?? {};
                controlCell.innerHTML = '<input type="range" min="' + (option.min ?? 150) + '" max="' + (option.max ?? 500) + '" class="colorTemperature">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) sendData(endpoint, {colorTemperature: parseInt(this.value)}); });
                break;

            case 'cover':
                controlCell.innerHTML = '<span>open</span>/<span>stop</span>/<span>close</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { if (valueCell.dataset.value != item.innerHTML) { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; sendData(endpoint, {cover: item.innerHTML}); } }) );
                break;

            case 'powerOnStatus':
                controlCell.innerHTML = '<span>on</span>/<span>off</span>/<span>previous</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { if (valueCell.dataset.value != item.innerHTML) { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; sendData(endpoint, {powerOnStatus: item.innerHTML}); } }) );
                break;

            case 'switch':
                row.dataset.name = 'status' + suffix;
                controlCell.innerHTML = '<span>on</span>/<span>off</span>/<span>toggle</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { if (valueCell.dataset.value != item.innerHTML) sendData(endpoint, {status: item.innerHTML}); }) );
                break;

            // bool
            case 'autoBrightness':
            case 'boost':
            case 'calibration':
            case 'childLock':
            case 'co2LongChart':
            case 'co2Relay':
            case 'co2RelayInvert':
            case 'ecoMode':
            case 'interlock':
            case 'nightBacklight':
            case 'pressureLongChart':
            case 'reverse':
            case 'statusMemory':
                controlCell.innerHTML = '<span>enable</span>/<span>disable</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { var value = item.innerHTML == 'enable' ? 'true' : 'false'; if (valueCell.dataset.value != value) {  valueCell.innerHTML = '<span class="shade">' + value + '</span>'; sendData(endpoint, {[name]: value}); } }) );
                break;

            // bool trigger
            case 'co2FactoryReset':
            case 'co2ForceCalibration':
                controlCell.innerHTML = '<span>trigger</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { if (valueCell.dataset.value != 'true') { valueCell.innerHTML = '<span class="shade">true</span>'; sendData(endpoint, {[name]: true}) } }) );
                break;

            // percentage
            case 'level':
            case 'position':
                valueCell.dataset.unit = '%';
                controlCell.innerHTML = '<input type="range" min="1" max="100" class="' + name + '">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + ' %</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) sendData(endpoint, {[name]: name == 'level' ? Math.round(this.value * 255 / 100) : parseInt(this.value)}); });
                break;

            // number
            case 'altitude':
            case 'boostTimeout':
            case 'co2High':
            case 'co2Low':
            case 'co2ManualCalibration':
            case 'detectionDelay':
            case 'distanceMax':
            case 'distanceMin':
            case 'ecoTemperature':
            case 'fadingTime':
            case 'humidityOffset':
            case 'pattern':
            case 'reportingDelay':
            case 'sensitivity':
            case 'targetTemperature':
            case 'temperatureOffset':
            case 'threshold':
            case 'timer':
            //
            case 'saturdayP1Temperature':
            case 'saturdayP2Temperature':
            case 'saturdayP3Temperature':
            case 'saturdayP4Temperature':
            case 'sundayP1Temperature':
            case 'sundayP2Temperature':
            case 'sundayP3Temperature':
            case 'sundayP4Temperature':
            case 'weekdayP1Temperature':
            case 'weekdayP2Temperature':
            case 'weekdayP3Temperature':
            case 'weekdayP4Temperature':

                var option = options[name] ?? {};

                if (isNaN(option.min) || isNaN(option.max))
                    break;

                if (option.unit)
                    valueCell.dataset.unit = option.unit;

                controlCell.innerHTML = '<input type="range" min="' + option.min + '" max="' + option.max + '" step="' + (option.step ?? 1) + '">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + (option.unit ? ' ' + option.unit : '') + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) sendData(endpoint, {[name]: parseFloat(this.value)}); });
                break;

            // string
            case 'buttonMode':
            case 'detectionMode':
            case 'distanceMode':
            case 'indicatorMode':
            case 'leftMode':
            case 'lightType':
            case 'operationMode':
            case 'rightMode':
            case 'sensitivityMode':
            case 'sensorType':
            case 'switchMode':
            case 'switchType':

                if (!options[name])
                    break;

                options[name].forEach((item, index) => { controlCell.innerHTML += (index ? '/' : '') + '<span class="control">' + item + '</span>'; });
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { if (valueCell.dataset.value != item.innerHTML) { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; sendData(endpoint, {[name]: item.innerHTML}); } }) );
                break;

            // time
            case 'saturdayP1Time':
            case 'saturdayP2Time':
            case 'saturdayP3Time':
            case 'saturdayP4Time':
            case 'sundayP1Time':
            case 'sundayP2Time':
            case 'sundayP3Time':
            case 'sundayP4Time':
            case 'weekdayP1Time':
            case 'weekdayP2Time':
            case 'weekdayP3Time':
            case 'weekdayP4Time':
                controlCell.innerHTML = '<input type="time" value="00:00"><button class="inline">Set</button>';
                controlCell.querySelector('button').addEventListener('click', function() { var value = controlCell.querySelector('input[type="time"]').value; var data = value.split(':'); if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; sendData(endpoint, {[name.replace('Time', 'Hour')]: parseInt(data[0]), [name.replace('Time', 'Minute')]: parseInt(data[1])}); } });
                break;

            default:
                control = false;
        }
    });

    if (!endpoints)
        return;

    if (!endpoints.fd.includes(endpoint))
        isNaN(endpoint) ? endpoints.fd.unshift(endpoint) : endpoints.fd.push(endpoint);

    if (!endpoints.td.includes(endpoint) && control)
        isNaN(endpoint) ? endpoints.td.unshift(endpoint) : endpoints.td.push(endpoint);
}

function updateExpose(endpoint, name, value)
{
    var suffix = isNaN(endpoint) ? '' : '-' + endpoint;
    var row = document.querySelector('.deviceInfo table.exposes tr[data-name="' + name + suffix + '"]');
    var cell = row ? row.querySelector('td.value') : null;

    if (cell)
    {
        switch (name)
        {
            case 'color':
                colorPicker.color.rgb = {r: value[0], g: value[1], b: value[2]};
                cell.innerHTML = '<div class="color" style="background-color: rgb(' + value[0] + ', ' + value[1] + ', ' + value[2] + ');"></div>';
                break;

            case 'status':
                cell.innerHTML = '<i class="icon-enable ' + (value == 'on' ? 'warning' : 'shade') + '"></i>';
                break;

            // number
            case 'colorTemperature':
            case 'level':
            case 'position':
            //
            case 'altitude':
            case 'boostTimeout':
            case 'co2High':
            case 'co2Low':
            case 'co2ManualCalibration':
            case 'detectionDelay':
            case 'distanceMax':
            case 'distanceMin':
            case 'ecoTemperature':
            case 'fadingTime':
            case 'humidityOffset':
            case 'pattern':
            case 'reportingDelay':
            case 'sensitivity':
            case 'targetTemperature':
            case 'temperatureOffset':
            case 'threshold':
            case 'timer':
            //
            case 'saturdayP1Temperature':
            case 'saturdayP2Temperature':
            case 'saturdayP3Temperature':
            case 'saturdayP4Temperature':
            case 'sundayP1Temperature':
            case 'sundayP2Temperature':
            case 'sundayP3Temperature':
            case 'sundayP4Temperature':
            case 'weekdayP1Temperature':
            case 'weekdayP2Temperature':
            case 'weekdayP3Temperature':
            case 'weekdayP4Temperature':

                var input = document.querySelector('.deviceInfo .exposes tr[data-name="' + name + suffix + '"] td.control input');

                if (name == 'level')
                    value = Math.round(value * 100 / 255);

                if (cell.dataset.value == value)
                    break;

                if (input)
                    input.value = value;

                cell.innerHTML = value + (cell.dataset.unit ? ' ' + cell.dataset.unit : '');
                break;

            default:
                cell.innerHTML = typeof value == 'number' ? (Math.round(value * 1000) / 1000) + (row.dataset.option != 'raw' ? exposeUnit(name) : '') : value;
                break;
        }

        cell.dataset.value = value;
        return;
    }

    if (name.startsWith('saturday') || name.startsWith('sunday') || name.startsWith('weekday'))
    {
        var item = name.replace('Hour', 'Time').replace('Minute', 'Time');
        var cell = document.querySelector('.deviceInfo .exposes tr[data-name="' + item + '"] td.value');

        if (cell && (name.endsWith('Hour') || name.endsWith('Minute')))
        {
            var input = document.querySelector('.deviceInfo .exposes tr[data-name="' + item + '"] td.control input[type="time"]');
            var time;

            if (!input)
                return;

            if (value < 10)
                value = '0' + value;

            time = input.value.split(':');
            input.value = name.endsWith('Hour') ? value + ':' + time[1] : time[0] + ':' + value;

            cell.dataset.value = input.value;
            cell.innerHTML = input.value;
        }
    }
}
