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
    var list;

    switch(expose)
    {
        case 'light':
            list = ['switch'].concat(options['light']);
            break;

        case 'cover':
            list = ['cover', 'position'];
            break;

        default:
            list = [expose];
            break;
    }

    list.forEach(name =>
    {
        var row = document.querySelector('.deviceInfo table.exposes').insertRow();
        var titleCell = row.insertCell();
        var valueCell = row.insertCell();
        var controlCell = row.insertCell();

        row.dataset.name = name + suffix;
        titleCell.innerHTML =  exposeTitle(name, options['name'] ?? endpoint);
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
                var option = options['colorTemperature'] ?? {};
                controlCell.innerHTML = '<input type="range" min="' + (option.min ?? 150) + '" max="' + (option.max ?? 500) + '" class="colorTemperature">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span class="shade">' + this.value + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { sendData(endpoint, {colorTemperature: parseInt(this.value)}); });
                break;

            case 'cover':
                controlCell.innerHTML = '<span>open</span>/<span>stop</span>/<span>close</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {cover: item.innerHTML}); }) );
                break;

            case 'powerOnStatus':
                controlCell.innerHTML = '<span>on</span>/<span>off</span>/<span>previous</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {powerOnStatus: item.innerHTML}); }) );
                break;

            case 'switch':
                row.dataset.name = 'status' + suffix;
                controlCell.innerHTML = '<span>on</span>/<span>off</span>/<span>toggle</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {status: item.innerHTML}); }) );
                break;

            // bool
            case 'autoBrightness':
            case 'calibration':
            case 'childLock':
            case 'co2LongChart':
            case 'co2Relay':
            case 'co2RelayInvert':
            case 'interlock':
            case 'nightBacklight':
            case 'pressureLongChart':
            case 'reverse':
            case 'statusMemory':
                controlCell.innerHTML = '<span>enable</span>/<span>disable</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {[name]: item.innerHTML == 'enable'}); }) );
                break;

            // bool trigger
            case 'co2FactoryReset':
            case 'co2ForceCalibration':
                controlCell.innerHTML = '<span>trigger</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {[name]: true}); }) );
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
            case 'co2High':
            case 'co2Low':
            case 'co2ManualCalibration':
            case 'detectionDelay':
            case 'distanceMax':
            case 'distanceMin':
            case 'fadingTime':
            case 'heatingPoint':
            case 'humidityOffset':
            case 'pattern':
            case 'reportingDelay':
            case 'sensitivity':
            case 'temperatureOffset':
            case 'threshold':
            case 'timer':

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
            case 'switchMode':
            case 'switchType':

                if (!options[name])
                    break;

                options[name].forEach((item, index) => { controlCell.innerHTML += (index ? '/' : '') + '<span class="control">' + item + '</span>'; });
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {[name]: item.innerHTML}); }) );
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

    if (!cell)
        return;

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
        case 'co2High':
        case 'co2Low':
        case 'co2ManualCalibration':
        case 'detectionDelay':
        case 'distanceMax':
        case 'distanceMin':
        case 'fadingTime':
        case 'heatingPoint':
        case 'humidityOffset':
        case 'pattern':
        case 'reportingDelay':
        case 'sensitivity':
        case 'temperatureOffset':
        case 'threshold':
        case 'timer':

            var control = document.querySelector('.deviceInfo .exposes tr[data-name="' + name + suffix + '"] td.control input');

            if (name == 'level')
                value = Math.round(value * 100 / 255);

            if (cell.dataset.value == value)
                break;

            if (control)
                control.value = value;

            cell.dataset.value = value;
            cell.innerHTML = value + (cell.dataset.unit ? ' ' + cell.dataset.unit : '');
            break;

        default:
            cell.innerHTML = typeof value == 'number' ? (Math.round(value * 1000) / 1000) + (row.dataset.option != 'raw' ? exposeUnit(name) : '') : value;
            break;
    }
}
