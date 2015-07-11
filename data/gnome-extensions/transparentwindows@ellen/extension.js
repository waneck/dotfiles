const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Widget = Me.imports.widget;

const Gettext = imports.gettext.domain('transparentwindows');
const _ = Gettext.gettext;

let settings, indicator, on_window_created, opacityChangedID, stateChangedID, terminalTitle, terminalOpacity;
var transparent = _("Transparent");
var opaque = _("Opaque");
var c_t = _("Tr");
var c_o = _("Op");
var OpacityHashMap = {};
var opacity_opaque = 255;
var handled_window_types = [
  Meta.WindowType.NORMAL,
  Meta.WindowType.DESKTOP,
  Meta.WindowType.DOCK,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  Meta.WindowType.TOOLBAR,
  Meta.WindowType.MENU,
  Meta.WindowType.UTILITY,
  Meta.WindowType.SPLASHSCREEN,
];

const Indicator = new Lang.Class({
    Name: 'TransparentMenu',
    Extends: PanelMenu.Button,

    _init: function() {
    	//get settings from schema
        this._settings = Convenience.getSettings();
       	this._mystate = this._settings.get_int('mystate');
       	this._rawOppacity = this._settings.get_int('opacity');
       	this._labelreadyOpacity = ((this._rawOppacity - 50) / opacity_opaque); // changes (int) into sth that will fit into slider
       	//add label state for compact toggle
    	this._labelState = this._settings.get_int('compactindicator');
        //add panel label for extension
        this.parent(St.Align.START);
        this.label = new St.Label({ text: '' });
        this._updateLabel();
        this.actor.add_actor(this.label);
        //add on/off toggle
        this._tsToggle = new PopupMenu.PopupSwitchMenuItem(_("Transparent windows"), false, { style_class: 'popup-subtitle-menu-item' });
        this._tsToggle.connect('toggled', Lang.bind(this, this._onToggled));
        this._tsToggle.setToggleState(this._mystate);
        this.menu.addMenuItem(this._tsToggle);
        //add compact togle
        this._compactToggle = new PopupMenu.PopupSwitchMenuItem(_("Compact extension indicator"), false, { style_class: 'popup-subtitle-menu-item' });
        this._compactToggle.connect('toggled', Lang.bind(this, this._toggleCompact));
        this._compactToggle.setToggleState(this._labelState);
        this.menu.addMenuItem(this._compactToggle);
        //add global transparency slider
        this._tsValueSlider = new Widget.SliderItem(_("Global transparency value"), 0.81);
        this._tsValueSlider.connect('drag-end', Lang.bind(this, this._onValueChanged));
        this.menu.addMenuItem(this._tsValueSlider);
        //add active window transparency slider
        this._tsValueSlider_active = new Widget.SliderItem(_("Active window custom transparency"), 0.81);
        this._tsValueSlider_active.connect('drag-end', Lang.bind(this, this._onValueChanged_active));
        this.menu.addMenuItem(this._tsValueSlider_active);
	//add remove custom transparency button
        this._clearActiveToggle = new PopupMenu.PopupSwitchMenuItem(_("Clear active window transparency"), false, { style_class: 'popup-subtitle-menu-item' });
        this._clearActiveToggle.connect('toggled', Lang.bind(this, this._onToggled_clear_active));
        this._clearActiveToggle.setToggleState(0);
        this.menu.addMenuItem(this._clearActiveToggle);
		//add clear all custom transparency button
		this._clearAllToggle = new PopupMenu.PopupSwitchMenuItem(_("Clear all custom transparency"), false, { style_class: 'popup-subtitle-menu-item' });
        this._clearAllToggle.connect('toggled', Lang.bind(this, this._onToggled_clear));
        this._clearAllToggle.setToggleState(0);
        this.menu.addMenuItem(this._clearAllToggle);

    },
    
    _updateLabel: function() {
        if (this._settings.get_int('mystate') == 1) {
        	if (!this._labelState) {
				this.label.set_text(_(transparent));        			
        	} else {
        		this.label.set_text(_(c_t));
        	}	
        } else {
        	if (!this._labelState) {
	        	this.label.set_text(_(opaque));
        	} else {
        		this.label.set_text(_(c_o));
        	}
        }
    },
    
    _toggleCompact: function() {
    	this._settings.set_int('compactindicator', this._compactToggle.state)
    	this._labelState = this._compactToggle.state;
    	this._updateLabel(); 
    },
    
    _onToggled_clear: function(){
  		this._clearAllToggle.setToggleState(0);
  		OpacityHashMap = {};
  		updateOpacity();
    },
    
    _onToggled_clear_active: function(){
  		delete OpacityHashMap[getActivePid()];
  		updateOpacity();
  		this._clearActiveToggle.setToggleState(0);
    },
    
    _onValueChanged: function() {
        var oppa = Math.floor((this._tsValueSlider.value * 205) + 50);
        this._settings.set_int('opacity', oppa);
        this._updateLabel();
    },
    
    _onValueChanged_active: function() {
    	if (this._settings.get_int('onlyterminal') < 1) {
        	var oppa = Math.floor((this._tsValueSlider_active.value * 205) + 50);
			setCustomOpacity(oppa);
		}
    },

    _onToggled: function() {
        var mystate = settings.get_int('mystate');
        if (mystate == 1) {
            mydisconnect();
        }
        else if (mystate == 0) {
            settings.set_int('mystate', 1);
        }
        this._updateLabel();
    },

});
// finds the PID of the process that created the window. 
function getActivePid() {
	var somepid = false;
	global.get_window_actors().forEach(function(wa) {
           var meta_win = wa.get_meta_window();
           if (meta_win.has_focus()) {
           		somepid = meta_win.get_pid();
           }
    });
    return somepid;
}
// change opacity of focused window only and save setting
function setCustomOpacity(opacity) {
	global.get_window_actors().forEach(function(wa) {
           var meta_win = wa.get_meta_window();
           if (meta_win.has_focus()) {
				OpacityHashMap[meta_win.get_pid()] = opacity;
				setOpacity(wa, opacity);
           }
        });
}
// checks if a given window has custom oppacity applied 
function hasCustomOpacity(pid_id) {
	if (pid_id in OpacityHashMap) {
		return true;
	} else {
		return false;
	}
}
// checks if the given window can have oppacity changed
function handled_window_type(wtype) {
    for (var i = 0; i < handled_window_types.length; i++) {
        let hwtype = handled_window_types[i];
        if (hwtype == wtype) {
            return true;
        } else if (hwtype > wtype) {
            return false;
        }
    }
    return false;
}
// applys opacity value to given window
function setOpacity(window_actor, target_opacity) {
    window_actor.opacity = target_opacity;
}

function toggleState() {
    mystate = settings.get_int('mystate');
    if (mystate == 1) {
        mydisconnect();
    }
    else if (mystate == 0) {
        settings.set_int('mystate', 1);
    }
}
// called to make all windows opaque
function mydisconnect() {
    global.get_window_actors().forEach(function(window_actor) {
        window_actor.opacity =  opacity_opaque;
    });
    settings.set_int('mystate', 0);
}
function updateOpacity() {
	if (settings.get_int('onlyterminal') > 0) {
		smallUpdateOpacity();
	} else if (settings.get_int('autoterminal') > 0) {
		halfUpdateOpacity();
	} else {
		fullUpdateOpacity();
	}
}
//small updateOpacity, just for terminals
function smallUpdateOpacity() {
	if (settings.get_int('mystate') > 0) {
	var terminalTitle = settings.get_string('terminal-title');
    var terminalOpacity = settings.get_int('terminalopacity');
        global.get_window_actors().forEach(function(wa) {
            var meta_win = wa.get_meta_window();
            if (!meta_win) {
                return;
            }
            	var w_title = meta_win.get_title();
           		if (w_title.indexOf(terminalTitle) > -1) {
        			setOpacity(wa, terminalOpacity);
        		}             
        });
	}
}
// half update opacity, just global and terminals
function halfUpdateOpacity() {
  	var terminalTitle = settings.get_string('terminal-title');
    var terminalOpacity = settings.get_int('terminalopacity');
    if (settings.get_int('mystate') > 0) {
    	var opacity_transparent = settings.get_int('opacity');
        global.get_window_actors().forEach(function(wa) {
            var meta_win = wa.get_meta_window();
            if (!meta_win) {
                return;
            }
           
            if (handled_window_type(meta_win.get_window_type())) {
            	var w_title = meta_win.get_title();
            	if (w_title.indexOf(terminalTitle) > -1) {
        			setOpacity(wa, terminalOpacity);
        		} else {
            		setOpacity(wa, opacity_transparent);	
            	}
            }            
        });
    }
}
// Updates opacity, full run. 
function fullUpdateOpacity() {
  	if (settings.get_int('mystate') > 0) {
	  	var opacity_inactive = settings.get_int('opacityinactive');
	  	var terminalTitle = settings.get_string('terminal-title');
		var terminalOpacity = settings.get_int('terminalopacity');
    	var win_exist = {};
      	var opacity_transparent = settings.get_int('opacity');
      	if (settings.get_int('useinactive') < 1) {
			opacity_inactive = opacity_transparent;
		}
        global.get_window_actors().forEach(function(wa) {
            var meta_win = wa.get_meta_window();
            if (!meta_win) {
                return;
            }
           
            if (handled_window_type(meta_win.get_window_type())) {
            	var pid = meta_win.get_pid();
            	var w_title = meta_win.get_title();
            	win_exist[pid] = "i_exist";
            	if (hasCustomOpacity(pid)) {
            		setOpacity(wa, OpacityHashMap[pid]);
            	} else if (w_title.indexOf(terminalTitle) > -1) {
        			setOpacity(wa, terminalOpacity);
        		} else {
        			if (meta_win.has_focus()) {
           				setOpacity(wa, opacity_transparent);
           			}
            		else {
            			setOpacity(wa, opacity_inactive);
            		}	
            	}
            }            
        });
        for ( var key in OpacityHashMap) {
        	if (key in win_exist) {
        		// do nothing since the process exists
        	} else {
        		delete OpacityHashMap[key];
        	}
        }
    }
}
//hides the panel indicator if not needed
function myAutoHide() {
	if (settings.get_int('showinpanel') > 0) {
		if (typeof Main.panel._statusArea === 'undefined') {
       		Main.panel.statusArea.myoppacitty.actor.hide();
    	} else {
        	Main.panel._statusArea.myoppacitty.actor.hide();
    	}
	} else {
		if (typeof Main.panel._statusArea === 'undefined') {
        	Main.panel.statusArea.myoppacitty.actor.show();
    	} else {
        	Main.panel._statusArea.myoppacitty.actor.show();
    	}
	}
}
function init() {
    settings = Convenience.getSettings();
    Convenience.initTranslations("transparentwindows");
}

function enable() {
    indicator = new Indicator();
    Main.panel.addToStatusArea('myoppacitty', indicator);
    opacityChangedID = settings.connect('changed::opacity', function () { updateOpacity();  });
    stateChangedID = settings.connect('changed::mystate', function () { updateOpacity();  });
    autoterminalChanged = settings.connect('changed::autoterminal', function () { updateOpacity();  });
    terminalChanged = settings.connect('changed::onlyterminal', function () { updateOpacity();  });
    hideChanged = settings.connect('changed::showinpanel', function () { myAutoHide();  });
    on_window_created = global.display.connect('window-created', updateOpacity);
    on_restacked = global.screen.connect('restacked', updateOpacity);
    myAutoHide();
    updateOpacity();
}

function disable() {
    global.display.disconnect(on_window_created);
    global.display.disconnect(on_restacked);
    settings.disconnect(opacityChangedID);
    settings.disconnect(stateChangedID);
    settings.disconnect(hideChanged);
    settings.disconnect(autoterminalChanged);
    settings.disconnect(terminalChanged);
    mydisconnect();
    indicator.destroy();
}
