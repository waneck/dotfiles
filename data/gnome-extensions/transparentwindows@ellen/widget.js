/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/**
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Lang = imports.lang;

const SliderItem = new Lang.Class({
    Name: "SliderItem",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(label, value) {
        this.parent();

        this._box = new St.Table({style_class: 'slider-item'});

        this._slider = new Slider.Slider(value);
        this._label = new St.Label({text: label});

        this._box.add(this._label, {row: 0, col: 0, x_expand: false});
        this._box.add(this._slider.actor, {row: 1, col: 0, x_expand: true});

        this.actor.add(this._box, {span: -1, expand: true});
    },

    setValue: function(value) {
        this._slider.setValue(value);
    },

    setLabel: function(text) {
        if (this._label.clutter_text)
            this._label.text = text;
    },

    connect: function(signal, callback) {
        this._slider.connect(signal, callback);
    },
    
    get value() {
	return this._slider.value;
    },
});
