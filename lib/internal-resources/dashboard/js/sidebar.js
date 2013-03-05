(function() {
  var key = $.cookie('DpdSshKey');
  _dpd.ajax.headers = {
    'dpd-ssh-key': key || true
  };
})();

$(document).ready(function() {
  var resourceSidebarTemplate = _.template($('#resource-sidebar-template').html())
    , moduleSidebarTemplate = _.template($('#module-sidebar-template').html())
    , resourceTypesTemplate = _.template($('#resource-types-template').html())
    , resources
    , resourceTypes
    , modules
    , resourceMenu = ui.menu()
    , currentMenuResource = null;

  
  setupResourceMenu();
  loadResourceTypes();
  loadResources();

  loadModules();
  handleModuleMenuEvents();

  $('#resource-types').on('click', 'a', function() {
    createResource($(this).attr('data-id'));
  });

  function loadResourceTypes() {
    dpd('__resources').get('types', function(res, err) {
      var types = Object.keys(res).reduce(function(prevValue, curValue) {
        res[curValue].id = curValue;
        prevValue.push(res[curValue]);
        return prevValue;
      }, []);
      resourceTypes = res;
      $('#resource-types').html(resourceTypesTemplate({types: types}));
      renderSidebar();
    });
  }
  
  function setupResourceMenu(argument) {
    resourceMenu.add('Rename', function() {
      renameResource(currentMenuResource);
    });
    
    resourceMenu.add('Delete', function() {
      deleteResource(currentMenuResource);
    });
  }

  function loadResources() {
    dpd('__resources').get(function(res, err) {
      resources = res.sort(function(a, b) {
        var sort = a.ctime - b.ctime;
        if (sort === 0) {
          sort = a.id.localeCompare(b.id);
        }
        return sort;
      });
      renderSidebar();
    });
  }

  function renderSidebar() {
    if (!resourceTypes || !resources) return;

    $('#resource-sidebar-container > .hide').show();

    var $sidebar = $('#resource-sidebar').empty();

    if (resources.length) {
      $('#resources-empty').hide();
      resources.forEach(function(resource) {
        var $el = $(resourceSidebarTemplate({resource: resource, types: resourceTypes}));

        function showContextMenu(e) {
          var $options = $el.find('.options')
            , pos = $options.offset();
          currentMenuResource = resource;
          resourceMenu.moveTo(pos.left + $options.width(), pos.top + $options.height()).show();
          e.preventDefault();
        }

        $el.find('.pages-header').dblclick(function() {
          location.href = $(this).attr('href');
        }).click(function(e) {
          if (e.which === 2) { return true; }
          $el.find('.pages').slideToggle(200);
          return false;
        });

        $el.find('.options').click(function(e) {
          showContextMenu(e);
          return false;
        });
        $el.on('contextmenu', function(e) {
          showContextMenu(e);
          return false;
        });
        $el.appendTo($sidebar);
      });
    } else {
      $('#resources-empty').show();
    }
  }

  function loadModules() {
    dpd('__modules').get(function(_modules) {
      modules = _modules;
      renderModuleSidebar();
    });
  }

  function renderModuleSidebar() {
    if (!modules) return;

    var $sidebar = $('#module-sidebar').empty();
    if (modules.length) {
      var $el = $(moduleSidebarTemplate({modules: modules}));  
      $sidebar.append($el).show();
      $('#modules-empty').hide();
    } else {
      $sidebar.hide();
      $('#modules-empty').show();
    }
  }

  function handleModuleMenuEvents () {
    $('#module-sidebar').on('dblclick', '.pages-header', function() {
      location.href = $(this).attr('href');
    });

    $('#module-sidebar').on('click', '.pages-header', function(e) {
      if (e.which === 2) { return true; }
      $(this).parent().find('.pages').slideToggle(200);
      return false;
    });
  }


  function createResource(typeId) {
    var type = resourceTypes[typeId];
    pathDialog("Create", "Create New " + (type.label || type.id), type.defaultPath || ('/' + typeId.toLowerCase()), function(path) {
      dpd('__resources').post(path, {
          type: typeId
      }, function(res, err) {
        if (err) { return showError(err, "Could not create resource"); }
        location.href = "/dashboard" + path;
      });
    });
  }

  function deleteResource(resource) {
    ui.confirm("Delete " + resource.id + "?", "This cannot be undone!")
      .ok("Delete")
      .cancel("cancel")
      .overlay()
      .show(function(ok) {
        if (ok) {
          dpd('__resources').del(resource.id, function(res, err) {
            if (err) { return showError(err, "Could not delete resource"); }
            loadResources();
            if (resource.id === Context.resourceId) {
              location.href = "/dashboard";
            }
          });
        }
      });
  }

  function renameResource(resource) {
    pathDialog("Rename", "Rename " + resource.id, '/' + resource.id, function(newPath) {
      var oldPath = resource.id;
      resource.id = newPath;
      dpd('__resources').put(oldPath, resource, function(res, err) {
        if (err) { return showError(err, "Could not rename resource"); }
        loadResources();
        if (oldPath === Context.resourceId) {
          var relative = location.pathname.split('/dashboard/' + oldPath)[1] || '';
          location.href = '/dashboard/' + res.id + relative;
        }
      });
    });
  }

  function pathDialog(verb, title, defaultValue, fn) {
    var $input = $('<input type="text" value="' + defaultValue + '" />')
      , confirm;
    confirm = ui.confirm(title, $input)
      .ok(verb)
      .cancel("cancel")
      .overlay()
      .show(function(ok) {
        if (ok) fn($input.val());
      });
      
    $input.on('keypress', function(e) {
      setTimeout(function() {
        $input.val(sanitizeResourcePath($input.val()));  
        if (e.which == 13) {
          fn($input.val());
          confirm.hide();
        }
      }, 1);
    });
    setTimeout(function() {$input.focus();}, 1);
  }

  function sanitizeResourcePath(path) {
    path = path.toLowerCase().replace(/[ _]/g, '-').replace(/[^a-z0-9\/\-]/g, '');
    if (path.indexOf('/') !== 0) {
      path = '/' + path;
    }
    return path;
  }

  function showError(err, message) {
    var errMessage = err && err.message;
    ui.error(message, errMessage).sticky().effect('slide');
  }
});