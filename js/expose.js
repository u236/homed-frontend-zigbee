var colorPicker;

function exposeTitle(name, suffix)
{
    var title = name.replace(/([A-Z])/g, ' $1');

    if (isNaN(suffix))
        title = (suffix != 'common' ? suffix + ' ' : '') + title;
    else
        title += ' ' + suffix;

    return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
}

function exposeUnit(name)
{
    var unit;

    switch (name)
    {
        case 'battery':
        case 'level':
        case 'humidity':
        case 'mousture':
            unit = '%';
            break;

        case 'temperature':
        case 'localTemperature':
        case 'heatingPoint':
            unit = '°C';
            break;

        case 'targetDistance':
        case 'distanceMin':
        case 'distanceMax':
            unit = 'm';
            break;

        case 'detectionDelay':
        case 'fadingTime':
            unit = 's';
            break;

        case 'pressure':
            unit = 'kPa';
            break;

        case 'illuminance':
            unit = 'lux';
            break;

        case 'co2':
            unit = 'ppm';
            break;

        case 'voc':
            unit = 'ppb';
            break;

        case 'energy':
            unit = 'kW·h';
            break;

        case 'voltage':
            unit = 'V';
            break;
        case 'current':
            unit = 'A';
            break;

        case 'power':
            unit = 'W';
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

        switch (name)
        {
            case 'switch':
                row.dataset.name = 'status' + suffix;
                controlCell.innerHTML = '<span class="control">on</span>/<span>off</span>/<span>toggle</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {status: item.innerHTML}); }) );
                break;

            case 'powerOnStatus':
                controlCell.innerHTML = '<span class="control">on</span>/<span>off</span>/<span>previous</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {powerOnStatus: item.innerHTML}); }) );
                break;

            case 'cover':
                controlCell.innerHTML = '<span class="control">open</span>/<span>stop</span>/<span>close</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {cover: item.innerHTML}); }) );
                break;
                                
            case 'level':
                controlCell.innerHTML = '<input type="range" min="1" max="100" class="level">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span class="shade">' + this.value + ' %</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { sendData(endpoint, {level: Math.round(this.value * 255 / 100)}); });
                break;

            case 'colorTemperature':
                var option = options['colorTemperature'] ?? {};
                controlCell.innerHTML = '<input type="range" min="' + (option.min ?? 150) + '" max="' + (option.max ?? 500) + '" class="colorTemperature">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span class="shade">' + this.value + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { sendData(endpoint, {colorTemperature: parseInt(this.value)}); });
                break;

            case 'position':
                controlCell.innerHTML = '<input type="range" min="0" max="100">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span class="shade">' + this.value + ' %</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { sendData(endpoint, {position: parseInt(this.value)}); });
                break;
            
            case 'pattern':
            case 'heatingPoint':
            case 'timer':
            case 'threshold':
            case 'sensitivity':
            case 'distanceMin':
            case 'distanceMax':
            case 'detectionDelay':
            case 'fadingTime':
            case 'reportingDelay':
            case 'temperatureOffset':

                var option = options[name] ?? {};

                if (isNaN(option.min) || isNaN(option.max))
                    break;

                controlCell.innerHTML = '<input type="range" min="' + option.min + '" max="' + option.max + '" step="' + (option.step ?? 1) + '">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span class="shade">' + this.value + exposeUnit(name) + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { sendData(endpoint, {[name]: parseFloat(this.value)}); });
                break;

            case 'color':
                colorPicker = new iro.ColorPicker(controlCell, {layout: [{component: iro.ui.Wheel}], width: 150});
                colorPicker.on("input:end", function() { sendData(endpoint, {color: [colorPicker.color.rgb.r, colorPicker.color.rgb.g, colorPicker.color.rgb.b]}); });
                break;
                
            case 'statusMemory':
            case 'interlock':
            case 'childLock':
            case 'calibration':
            case 'reverse':
                controlCell.innerHTML = '<span class="control">enable</span>/<span>disable</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {[name]: item.innerHTML == 'enable'}); }) );
                break;

            case 'sensitivityMode':
            case 'detectionMode':
            case 'distanceMode':
            case 'leftMode':
            case 'rightMode':
            case 'buttonMode':
            case 'operationMode':
            case 'indicatorMode':
            case 'switchMode':
            case 'lightType':
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
    var cell = document.querySelector('.deviceInfo table.exposes tr[data-name="' + name + suffix + '"] td.value');

    if (!cell)
        return;
        
    switch (name)
    {
        case 'status':
            cell.innerHTML = '<i class="icon-enable ' + (value == 'on' ? 'warning' : 'shade') + '"></i>';
            break;

        case 'level':
        case 'colorTemperature':
        case 'position':
        case 'pattern':
        case 'timer':
        case 'threshold':
        case 'sensitivity':
        case 'distanceMin':
        case 'distanceMax':
        case 'detectionDelay':
        case 'fadingTime':
        case 'reportingDelay':
        case 'temperatureOffset':

            var control = document.querySelector('.deviceInfo .exposes tr[data-name="' + name + suffix + '"] td.control input');

            if (name == 'level')
                value = Math.round(value * 100 / 255);

            if (control)
                control.value = value;

            cell.innerHTML = value + exposeUnit(name);
            break;

        case 'color':
            colorPicker.color.rgb = {r: value[0], g: value[1], b: value[2]};
            cell.innerHTML = '<div class="color" style="background-color: rgb(' + value[0] + ', ' + value[1] + ', ' + value[2] + ');"></div>';
            break;

        default:
            cell.innerHTML = typeof value == 'number' ? (Math.round(value * 1000) / 1000) + exposeUnit(name) : value;
            break;
    }
}
