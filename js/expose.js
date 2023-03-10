function exposeTitle(name, suffix)
{
    var title = name.replace(/([A-Z])/g, ' $1').toLowerCase();
    return title.charAt(0).toUpperCase() + title.slice(1) + (isNaN(suffix) ? '' : ' ' + suffix);
}

function exposeUnit(name)
{
    switch (name)
    {
        case 'battery':     return '%';
        case 'temperature': return '°C';
        case 'pressure':    return 'kPa';
        case 'humidity':    return '%';
        case 'mousture':    return '%';
        case 'illuminance': return 'lux';
        case 'co2':         return 'ppm';
        case 'voc':         return 'ppb';
        case 'energy':      return 'kW·h';
        case 'voltage':     return 'V';
        case 'current':     return 'A';
        case 'power':       return 'W';
    }
}

function addExpose(endpoint, expose, options)
{
    var suffix = isNaN(endpoint) ? '' : '-' + endpoint;
    var list;

    switch(expose)
    {
        case 'light':
            list = ['switch'].concat(options.light);
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
        titleCell.innerHTML =  exposeTitle(name, endpoint);
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
                controlCell.innerHTML = '<span class="control">on</span>/<span>off</span>/<span>toggle</span>/<span>previous</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {powerOnStatus: item.innerHTML}); }) );
                break;

            case 'level':
                controlCell.innerHTML = '<input type="range" min="1" max="100" step="1">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span class="shade">' + this.value + ' %</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { sendData(endpoint, {level: Math.round(this.value * 255 / 100)}); });
                break;

            case 'colorTemperature':
            case 'pattern':
            case 'timer':
            case 'threshold':
                var option = options[name] ?? {};
                controlCell.innerHTML = '<input type="range" min="' + (option.min ?? 150) + '" max="' + (option.max ?? 500) + '">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span class="shade">' + this.value + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { sendData(endpoint, {[name]: parseInt(this.value)}); });
                break;

            case 'leftMode':
            case 'rightMode':
            case 'buttonMode':
            case 'indicatorMode':
            case 'switchMode':
            case 'sensitivityMode':
            case 'detectionMode':
            case 'distanceMode':
            case 'operationMode':

                if (!options[name])
                    break;

                options[name].forEach((item, index) => { controlCell.innerHTML += (index ? '/' : '') + '<span class="control">' + item + '</span>'; });
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {[name]: item.innerHTML}); }) );
                break;
        }
    });
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
        case 'pattern':
        case 'timer':
        case 'threshold':
        case 'reportingDelay':
        case 'temperatureOffset':

            var control = document.querySelector('.deviceInfo .exposes tr[data-name="' + name + suffix + '"] td.control input');

            if (name == 'level')
            {
                value = Math.round(value * 100 / 255);
                cell.innerHTML = value + ' %';
            }
            else
                cell.innerHTML = value;

            if (control)
                control.value = value;

            break;


        case 'color':
            cell.innerHTML = '<div class="color" style="background-color: rgb(' + value[0] + ', ' + value[1] + ', ' + value[2] + ');"></div>';
            break;

        default:

            if (typeof value == 'number')
            {
                var unit = exposeUnit(name);
                cell.innerHTML = (Math.round(value * 1000) / 1000) + (unit ? ' ' + unit : '');
                break;
            }

            cell.innerHTML = value;
            break;
    }
}
