/*global global, log */ // <-- jshint
/*jshint unused: true, maxlen: 150 */
/* Workspaces Grid GNOME shell extension.
 *
 * mathematical.coffee <mathematical.coffee@gmail.com>
 *
 * Inspired by Frippery Static Workspaces[0] by R. M. Yorston
 *
 * [0]: https://extensions.gnome.org/extension/12/static-workspaces/
 *
 * ----------------------------------------------------
 * Notes for other developers
 * --------------------------
 * If you wish to see if your extension is compatible with this, note:
 *
 * This extension exports a number of constants and functions to an object
 * global.screen.workspace_grid for your convenience. Note that this extension
 * must be enabled for this all to work. global.screen.workspace_grid contains:
 *
 *   (Exported Constants)
 *   - Directions = { UP, LEFT, RIGHT, DOWN } : directions for navigating (see
 *                                              moveWorkspaces further down)
 *     (NOTE: for 3.6+ you can just use Meta.MotionDirection.{UP,LEFT,RIGHT,DOWN})
 *   - rows     : number of rows of workspaces
 *   - columns  : number of columns of workspaces
 *
 *   (Exported Functions)
 *   - moveWorkspace : switches workspaces in the direction specified, being
 *                     either UP, LEFT, RIGHT or DOWN (see Directions).
 *   - rowColToIndex : converts the row/column into an index for use with (e.g.)
 *                     global.screen.get_workspace_by_index(i)
 *   - indexToRowCol : converts an index (0 to global.screen.n_workspaces-1) to
 *                     a row and column
 *   - getWorkspaceSwitcherPopup : gets our workspace switcher popup so you
 *                                 can show it if you want
 *   - calculateWorkspace : returns the workspace index in the specified direction
 *                          to the current, taking into account wrapping.
 *
 * For example, to move to the workspace below us:
 *     const WorkspaceGrid = global.screen.workspace_grid;
 *     WorkspaceGrid.moveWorkspace(WorkspaceGrid.Directions.DOWN);
 *
 * I am happy to try help/give an opinion/improve this extension to try make it
 *  more compatible with yours, email me :)
 *
 * Listening to workspace_grid
 * ---------------------------
 * Say you want to know the number of rows/columns of workspaces in your
 * extension. Then you have to wait for this extension to load and populate
 * global.screen.workspace_grid.
 *
 * When the workspace_grid extension enables or disables it fires a
 *  'notify::n_workspaces' signal on global.screen.
 *
 * You can connect to this and check for the existence (or removal) of
 * global.screen.workspace_grid.
 *
 * Further notes
 * -------------
 * Workspaces can be changed by the user by a number of ways, and this extension
 * aims to cover them all:
 * - keybinding (wm.setKeybindingHandler)
 * - keybinding with global grab in progress (e.g. in Overview/lg): see
 *    Main._globalKeyPressHandler
 * - scrolling in the overview (WorkspacesView.WorkspacesDisplay._onScrollEvent)
 * - clicking in the overview.
 *
 * Dev notes for this extension
 * ----------------------------
 * From GNOME 3.4+ to keep workspaces static we can just do:
 * - org.gnome.shell.overrides.dynamic-workspaces false
 * - org.gnome.desktop.wm.preferences.num-workspaces <numworkspaces>
 * However then you can't drag/drop applications between workspaces (GNOME 3.4
 *  and 3.6 anyway)
 * In 3.8 you can drag/drop between workspaces with dynamic-workspace off, but you
 *  can't drag/drop to create a *new* workspace (or at least you don't get the
 *  animation showing that this is possible).
 *
 * Hence we make use of the Frippery Static Workspace code.
 *
 * See also the edited workspaces indicator
 * http://kubiznak-petr.ic.cz/en/workspace-indicator.php (this is column-major).
 *
 * GNOME 3.2 <-> GNOME 3.4
 * -----------------------
 * - Main.wm.setKeybindingHandler -> Meta.keybindings_set_custom_handler
 * - keybinding names '_' -> '-'
 * - keybinding callback: wm, binding, mask, window, backwards ->
 *    display, screen, window, binding
 * - keybinding callback: binding -> binding.get_name()
 * - destroy_children <-> destroy_all_children
 * - In 3.4 thumbnails box has a dropPlaceholder for dropping windows into new
 *   workspaces
 *
 * GNOME 3.4 <-> GNOME 3.6
 * ---------
 * - WorkspaceSwitcherPopup gets *destroyed* every time it disappears
 * - Main.overview._workspacesDisplay -> Main.overview._viewSelector._workspacesDisplay
 * - The old WorkspaceSwitcherPopup _redraw + _position combined into _redisplay.
 * - Directions instead of being 'switch-to-workspace-*' are now Meta.MotionDirection
 * - The workspace popup also shows for 'move-to-workspace-*' binings.
 * - actionMoveWorkspace{Up,Down} --> actionMoveWorkspace
 *
 * GNOME 3.6 <-> GNOME 3.8
 * ---------
 * - Meta.keybindings_set_custom_handler -> Main.wm.setCustomKeybindingHandler
 *   (we've almost done a full loop back to 3.2...)
 * - use of setCustomKeybindingHandler allows modes (normal/overview) to be
 *    passed in, so it's no longer to override globalKeyPressHandler
 * - calculateWorkspace can use get_neighbor() which is now exposed.
 * - no need to reconstruct workspace controls (I think)
 * - _allocate code changed quite a bit to ensure thumbnails fit horizontally
 *    as the width given to _allocate is now the actual *onscreen* width
 *    (used to be the preferred width I think whether or not that fit on screen).
 */

////////// CODE ///////////
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const OverviewControls = imports.ui.overviewControls;
const Tweener = imports.ui.tweener;
const WindowManager = imports.ui.windowManager;
const WorkspaceSwitcher = imports.ui.workspaceSwitcherPopup;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const WorkspacesView = imports.ui.workspacesView;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Prefs = Me.imports.prefs;

const KEY_ROWS = Prefs.KEY_ROWS;
const KEY_COLS = Prefs.KEY_COLS;
const KEY_WRAPAROUND = Prefs.KEY_WRAPAROUND;
const KEY_WRAP_TO_SAME = Prefs.KEY_WRAP_TO_SAME;
const KEY_MAX_HFRACTION = Prefs.KEY_MAX_HFRACTION;
const KEY_MAX_HFRACTION_COLLAPSE = Prefs.KEY_MAX_HFRACTION_COLLAPSE;
const KEY_SHOW_WORKSPACE_LABELS = Prefs.KEY_SHOW_WORKSPACE_LABELS;

// laziness
const UP = Meta.MotionDirection.UP;
const DOWN = Meta.MotionDirection.DOWN;
const LEFT = Meta.MotionDirection.LEFT;
const RIGHT = Meta.MotionDirection.RIGHT;
const BindingToDirection = {
    'switch-to-workspace-up': UP,
    'switch-to-workspace-down': DOWN,
    'switch-to-workspace-left': LEFT,
    'switch-to-workspace-right': RIGHT,
    'move-to-workspace-up': UP,
    'move-to-workspace-down': DOWN,
    'move-to-workspace-left': LEFT,
    'move-to-workspace-right': RIGHT
};
/* it seems the max number of workspaces is 36
 * (MAX_REASONABLE_WORKSPACES in mutter/src/core/prefs.c)
 */
const MAX_WORKSPACES = 36;

/* Import some constants from other files and also some laziness */
const MAX_THUMBNAIL_SCALE = WorkspaceThumbnail.MAX_THUMBNAIL_SCALE;
const WORKSPACE_CUT_SIZE = WorkspaceThumbnail.WORKSPACE_CUT_SIZE;
const ThumbnailState = WorkspaceThumbnail.ThumbnailState;
const WMProto = WindowManager.WindowManager.prototype;
const TBProto = WorkspaceThumbnail.ThumbnailsBox.prototype;

/* storage for the extension */
let staticWorkspaceStorage = {};
let wmStorage = {};
let wvStorage = {};
let tbStorage = {};
let nWorkspaces;
let _workspaceSwitcherPopup = null;
let onScrollId = 0;
let settings = 0;

/***************
 * Helper functions
 ***************/
/* Converts an index (from 0 to global.screen.n_workspaces) into [row, column]
 * being the row and column of workspace `index` according to the user's layout.
 *
 * Row and column start from 0.
 */
function indexToRowCol(index) {
    // row-major. 0-based.
    return [Math.floor(index / global.screen.workspace_grid.columns),
       index % global.screen.workspace_grid.columns];
}

/* Converts a row and column (0-based) into the index of that workspace.
 *
 * If the resulting index is greater than MAX_WORKSPACES (the maximum number
 * of workspaces allowable by Mutter), it will return -1.
 */
function rowColToIndex(row, col) {
    // row-major. 0-based.
    let idx = row * global.screen.workspace_grid.columns + col;
    if (idx >= MAX_WORKSPACES) {
        idx = -1;
    }
    return idx;
}

/** Gets the workspace switcher popup, creating if it doesn't exist. */
function getWorkspaceSwitcherPopup() {
    if (!_workspaceSwitcherPopup) {
        _workspaceSwitcherPopup = new WorkspaceSwitcherPopup();
        // just in case.
        Main.wm._workspaceSwitcherPopup = _workspaceSwitcherPopup;
        // in GNOME 3.6 instead of storing the popup for next time, it's
        // destroyed every single time it fades out..
        _workspaceSwitcherPopup.connect('destroy', function () {
            _workspaceSwitcherPopup = null;
            Main.wm._workspaceSwitcherPopup = null;
        });
    }
    return _workspaceSwitcherPopup;
}

// calculates the workspace index in that direction.
function calculateWorkspace(direction, wraparound, wrapToSame) {
    let from = global.screen.get_active_workspace(),
        to = from.get_neighbor(direction).index();

    if (!wraparound || from.index() !== to) {
        return to;
    }

    // otherwise, wraparound is TRUE and from === to (we are at the edge)
    let [row, col] = indexToRowCol(from.index());
    switch (direction) {
        case LEFT:
            // we must be at the start of the row. go to the end of the row.
            col = global.screen.workspace_grid.columns - 1;
            if (!wrapToSame) row--;
            break;
        case RIGHT:
            // we must be at the end of the row. go to the start of the same row.
            col = 0;
            if (!wrapToSame) row++;
            break;
        case UP:
            // we must be at the top of the col. go to the bottom of the same col.
            row = global.screen.workspace_grid.rows - 1;
            if (!wrapToSame) col--;
            break;
        case DOWN:
            // we must be at the bottom of the col. go to the top of the same col.
            row = 0;
            if (!wrapToSame) col++;
            break;
    }
    if (col < 0 || row < 0) {
        to = global.screen.n_workspaces - 1;
    } else if (col > global.screen.workspace_grid.columns - 1 ||
               row > global.screen.workspace_grid.rows - 1) {
        to = 0;
    } else {
        to = rowColToIndex(row, col);
    }
    return to;
}


/* Switch to the appropriate workspace, showing the workspace switcher.
 * direction is either UP, LEFT, RIGHT or DOWN.
 *
 * This can occur through:
 * - keybinding (wm.setKeybindingHandler)
 * - keybinding with global grab in progress (e.g. Overview/lg)
 * - scrolling/clicking in the overview
 * - (other extensions, e.g. navigate with up/down arrows:
 *        https://extensions.gnome.org/extension/29/workspace-navigator/)
 */
function moveWorkspace(direction) {
    Main.wm.actionMoveWorkspace(direction);

    // show workspace switcher
    if (!Main.overview.visible) {
        getWorkspaceSwitcherPopup().display(direction, to);
    }
}

// GNOME 3.6: _redraw --> _redisplay
/************
 * Workspace Switcher that can do rows and columns as opposed to just rows.
 ************/
const WorkspaceSwitcherPopup = new Lang.Class({
    Name: 'WorkspaceSwitcherPopup',
    Extends: WorkspaceSwitcher.WorkspaceSwitcherPopup,

    // note: this makes sure everything fits vertically and then adjust the
    // horizontal to fit.
    _getPreferredHeight : function (actor, forWidth, alloc) {
        let children = this._list.get_children(),
            primary = Main.layoutManager.primaryMonitor,
            nrows = global.screen.workspace_grid.rows,
            availHeight = primary.height,
            height = 0,
            spacing = this._itemSpacing * (nrows - 1);

        availHeight -= Main.panel.actor.height;
        availHeight -= this.actor.get_theme_node().get_vertical_padding();
        availHeight -= this._container.get_theme_node().get_vertical_padding();
        availHeight -= this._list.get_theme_node().get_vertical_padding();

        for (let i = 0; i < global.screen.n_workspaces;
                i += global.screen.workspace_grid.columns) {
            let [childMinHeight, childNaturalHeight] =
                children[i].get_preferred_height(-1);
            children[i].get_preferred_width(childNaturalHeight);
            height += childNaturalHeight * primary.width / primary.height;
        }

        height += spacing;

        height = Math.min(height, availHeight);
        this._childHeight = (height - spacing) / nrows;

        // check for horizontal overflow and adjust.
        let childHeight = this._childHeight;
        this._getPreferredWidth(actor, -1, {});
        if (childHeight !== this._childHeight) {
            // the workspaces will overflow horizontally and ._childWidth &
            // ._childHeight have been adjusted to make it fit.
            height = this._childHeight * nrows + spacing;
            if (height > availHeight) {
                this._childHeight = (availHeight - spacing) / nrows;
            }
        }

        alloc.min_size = height;
        alloc.natural_size = height;
    },

    _getPreferredWidth : function (actor, forHeight, alloc) {
        let primary = Main.layoutManager.primaryMonitor,
            ncols = global.screen.workspace_grid.columns;
        this._childWidth = this._childHeight * primary.width / primary.height;
        let width = this._childWidth * ncols + this._itemSpacing * (ncols - 1),
            padding = this.actor.get_theme_node().get_horizontal_padding() +
                      this._list.get_theme_node().get_horizontal_padding() +
                      this._container.get_theme_node().get_horizontal_padding();

        // but constrain to at most primary.width
        if (width + padding > primary.width) {
            this._childWidth = (primary.width - padding -
                                this._itemSpacing * (ncols - 1)) / ncols;
            this._childHeight = this._childWidth * primary.height /
                                primary.width;
            width = primary.width - padding;
        }

        alloc.min_size = width;
        alloc.natural_size = width;
    },

    _allocate : function (actor, box, flags) {
        let children = this._list.get_children(),
            childBox = new Clutter.ActorBox(),
            x = box.x1,
            y = box.y1,
            prevX = x,
            prevY = y,
            i = 0;
        for (let row = 0; row < global.screen.workspace_grid.rows; ++row) {
            x = box.x1;
            prevX = x;
            for (let col = 0; col < global.screen.workspace_grid.columns; ++col) {
                childBox.x1 = prevX;
                childBox.x2 = Math.round(x + this._childWidth);
                childBox.y1 = prevY;
                childBox.y2 = Math.round(y + this._childHeight);

                x += this._childWidth + this._itemSpacing;
                prevX = childBox.x2 + this._itemSpacing;
                children[i].allocate(childBox, flags);
                i++;
                if (i >= MAX_WORKSPACES) {
                    break;
                }
            }
            if (i >= MAX_WORKSPACES) {
                break;
            }
            prevY = childBox.y2 + this._itemSpacing;
            y += this._childHeight + this._itemSpacing;
        }
    },

    // GNOME 3.6: old _redraw + _position is now combined into _redisplay
    // Also, workspace switcher is *destroyed* whenever it fades out.
    // Previously it was stored.
    _redisplay: function () {
        //log('redisplay, direction ' + this._direction + ', going to ' + this._activeWorkspaceIndex);
        this._list.destroy_all_children();

        for (let i = 0; i < global.screen.n_workspaces; i++) {
            let indicator = null;
            let name = Meta.prefs_get_workspace_name(i);

            if (i === this._activeWorkspaceIndex &&
                   this._direction === UP) {
                indicator = new St.Bin({
                    style_class: 'ws-switcher-active-up'
                });
            } else if (i === this._activeWorkspaceIndex &&
                   this._direction === DOWN) {
                indicator = new St.Bin({
                    style_class: 'ws-switcher-active-down'
                });
            } else if (i === this._activeWorkspaceIndex &&
                   this._direction === LEFT) {
                indicator = new St.Bin({
                    style_class: 'ws-switcher-active-left'
                });
            } else if (i === this._activeWorkspaceIndex &&
                   this._direction === RIGHT) {
                indicator = new St.Bin({
                    style_class: 'ws-switcher-active-right'
                });
            } else {
                indicator = new St.Bin({style_class: 'ws-switcher-box'});
            }
            if (settings.get_boolean(KEY_SHOW_WORKSPACE_LABELS) && i !== this._activeWorkspaceIndex) {
                indicator.child = new St.Label({
                    text: name,
                    style_class: 'ws-switcher-label'
                });
            }

            this._list.add_actor(indicator);
        }

        let primary = Main.layoutManager.primaryMonitor;
        let [containerMinHeight, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
        let [containerMinWidth, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
        this._container.x = primary.x + Math.floor((primary.width - containerNatWidth) / 2);
        this._container.y = primary.y + Main.panel.actor.height +
                            Math.floor(((primary.height - Main.panel.actor.height) - containerNatHeight) / 2);
    }

});

/* Keybinding handler.
 * Should bring up a workspace switcher.
 * Either activates the target workspace or if it's move-to-workspace-xxx
 * we should move the window as well as show the workspace switcher.
 * This is the same as WindowManager._showWorkspaceSwitcher but we don't
 * filter out RIGHT/LEFT actions like they do.
 */
function showWorkspaceSwitcher(display, screen, window, binding) {
    if (global.screen.n_workspaces === 1)
        return;

    let direction = BindingToDirection[binding.get_name()],
        to;
    if (binding.get_name().substr(0, 5) === 'move-') {
        // we've patched this
        to = Main.wm.actionMoveWindow(window, direction);
    } else {
        // we've patched this
        to = Main.wm.actionMoveWorkspace(direction);
    }

    // show workspace switcher
    if (!Main.overview.visible) {
        getWorkspaceSwitcherPopup().display(direction, to.index());
    }
}

/******************
 * Overrides the 'switch_to_workspace_XXX' keybindings
 * Relevant code in js/windowManager.js
 ******************/
function overrideKeybindingsAndPopup() {
    // note - we could simply replace Main.wm._workspaceSwitcherPopup and
    // not bother with taking over the keybindings, if not for the 'wraparound'
    // stuff.
    let bindings = Object.keys(BindingToDirection);
    for (let i = 0; i < bindings.length; ++i) {
        Main.wm.setCustomKeybindingHandler(bindings[i],
                                           Shell.KeyBindingMode.NORMAL |
                                           Shell.KeyBindingMode.OVERVIEW,
                                           showWorkspaceSwitcher);
	}

    // Override imports.ui.windowManager.actionMove* just in case other
    // extensions use them.
    wmStorage.actionMoveWorkspace = WMProto.actionMoveWorkspace;
    WMProto.actionMoveWorkspace = function (direction) {
        let from = global.screen.get_active_workspace_index(),
            to = calculateWorkspace(direction,
                    settings.get_boolean(KEY_WRAPAROUND),
                    settings.get_boolean(KEY_WRAP_TO_SAME)),
            ws = global.screen.get_workspace_by_index(to);

        if (to !== from) {
            ws.activate(global.get_current_time());
        }
        return ws;
    };
    wmStorage.actionMoveWindow = WMProto.actionMoveWindow;
    WMProto.actionMoveWindow = function (window, direction) {
        let to = calculateWorkspace(direction,
                settings.get_boolean(KEY_WRAPAROUND),
                settings.get_boolean(KEY_WRAP_TO_SAME)),
            ws = global.screen.get_workspace_by_index(to);

        if (to !== global.screen.get_active_workspace_index()) {
            Main.wm._movingWindow = window;
            window.change_workspace(ws);
            global.display.clear_mouse_mode();
            ws.activate_with_focus(window, global.get_current_time());
        }
        return ws;
    };
}

/* Restore the original keybindings */
function unoverrideKeybindingsAndPopup() {
    let bindings = Object.keys(BindingToDirection);
    for (let i = 0; i < bindings.length; ++i) {
        Main.wm.setCustomKeybindingHandler(bindings[i],
                                               Shell.KeyBindingMode.NORMAL |
                                               Shell.KeyBindingMode.OVERVIEW,
                                               Lang.bind(Main.wm,
                                                   Main.wm._showWorkspaceSwitcher));
    }

    _workspaceSwitcherPopup = null;

    WMProto.actionMoveWorkspace = wmStorage.actionMoveWorkspace;
    WMProto.actionMoveWindow = wmStorage.actionMoveWindow;
}

// GNOME 3.2 & 3.4: Main.overview._workspacesDisplay
// GNOME 3.6, 3.8: Main.overview._viewSelector._workspacesDisplay
function _getWorkspaceDisplay() {
    return Main.overview._workspacesDisplay ||
        Main.overview.viewSelector._workspacesDisplay  ||
        Main.overview._viewSelector._workspacesDisplay;
}

/******************
 * Overrides the workspaces display in the overview
 ******************/
const ThumbnailsBox = new Lang.Class({
    Name: 'ThumbnailsBox',
    Extends: WorkspaceThumbnail.ThumbnailsBox,

    /**
     * The following are overridden simply to incorporate ._indicatorX in the
     * same way as ._indicatorY
     **/
    _init: function () {
        // Note: we could just call this.parent(); this._inicatorX = 0; but
        // instead we replicate this.parent()'s code here so we can store
        // the signal IDs (it connects to Main.overview) so that we can delete
        // them properly on destroy!

        this.actor = new Shell.GenericContainer({ reactive: true,
                                                  style_class: 'workspace-thumbnails',
                                                  request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT });
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        this.actor._delegate = this;

        // When we animate the scale, we don't animate the requested size of the thumbnails, rather
        // we ask for our final size and then animate within that size. This slightly simplifies the
        // interaction with the main workspace windows (instead of constantly reallocating them
        // to a new size, they get a new size once, then use the standard window animation code
        // allocate the windows to their new positions), however it causes problems for drawing
        // the background and border wrapped around the thumbnail as we animate - we can't just pack
        // the container into a box and set style properties on the box since that box would wrap
        // around the final size not the animating size. So instead we fake the background with
        // an actor underneath the content and adjust the allocation of our children to leave space
        // for the border and padding of the background actor.
//        this._background = new St.Bin({ style_class: 'workspace-thumbnails-background' });

//        this.actor.add_actor(this._background);

        let indicator = new St.Bin({ style_class: 'workspace-thumbnail-indicator' });

        // We don't want the indicator to affect drag-and-drop
        Shell.util_set_hidden_from_pick(indicator, true);

        this._indicator = indicator;
        this.actor.add_actor(indicator);

        this._dropWorkspace = -1;
        this._dropPlaceholderPos = -1;
        this._dropPlaceholder = new St.Bin({ style_class: 'workspace-thumbnail-drop-indicator' });
        this.actor.add_actor(this._dropPlaceholder);
        this._spliceIndex = -1;

        this._targetScale = 0;
        this._scale = 0;
        this._pendingScaleUpdate = false;
        this._stateUpdateQueued = false;
        this._animatingIndicator = false;
        this._indicatorY = 0; // only used when _animatingIndicator is true

        this._stateCounts = {};
        for (let key in ThumbnailState)
            this._stateCounts[ThumbnailState[key]] = 0;

        this._thumbnails = [];

        this.actor.connect('button-press-event', function() { return true; });
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

        // @@ only change: store these IDs! (TODO: submit patch)
        this._signals = [];
        this._signals.push(Main.overview.connect('showing',
                    Lang.bind(this, this._createThumbnails)));
        this._signals.push(Main.overview.connect('hidden',
                    Lang.bind(this, this._destroyThumbnails)));
        this._signals.push(Main.overview.connect('item-drag-begin',
                    Lang.bind(this, this._onDragBegin)));
        this._signals.push(Main.overview.connect('item-drag-end',
                    Lang.bind(this, this._onDragEnd)));
        this._signals.push(Main.overview.connect('item-drag-cancelled',
                    Lang.bind(this, this._onDragCancelled)));
        this._signals.push(Main.overview.connect('window-drag-begin',
                    Lang.bind(this, this._onDragBegin)));
        this._signals.push(Main.overview.connect('window-drag-end',
                    Lang.bind(this, this._onDragEnd)));
        this._signals.push(Main.overview.connect('window-drag-cancelled',
                    Lang.bind(this, this._onDragCancelled)));

        this._settings = new Gio.Settings({ schema: OVERRIDE_SCHEMA });
        this._dynamicWorkspacesId = this._settings.connect(
                'changed::dynamic-workspaces',
                Lang.bind(this, this._updateSwitcherVisibility));

        // @@ added
        this._indicatorX = 0; // to match indicatorY
    },

    /* when the user clicks on a thumbnail take into account the x position
     * of that thumbnail as well as the y to determine which was clicked */
    _onButtonRelease: function (actor, event) {
        let [stageX, stageY] = event.get_coords();
        let [r, x, y] = this.actor.transform_stage_point(stageX, stageY);

        for (let i = 0; i < this._thumbnails.length; i++) {
            let thumbnail = this._thumbnails[i];
            let [w, h] = thumbnail.actor.get_transformed_size();
            // add in the x criteria
            if (y >= thumbnail.actor.y && y <= thumbnail.actor.y + h &&
                    x >= thumbnail.actor.x && x <= thumbnail.actor.x + w) {
                thumbnail.activate(event.get_time());
                break;
            }
        }

        return true;
    },

    /* with drag and drop: modify to look at the x direction as well as the y */
    handleDragOver: function (source, actor, x, y, time) {
        if (!source.realWindow && !source.shellWorkspaceLaunch && source != Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        let spacing = this.actor.get_theme_node().get_length('spacing');

        // There used to be lots of code about dragging a window either:
        //
        // * on a workspace, or:
        // * in the space "between" workspaces, in which case a new workspace
        //   is inserted if the window is dropped there.
        //
        // I do not support the second behaviour in this extension because
        // the number of workspaces is fixed (so there's no concept of adding
        // a new workspace).
        //
        // Instead I'll just add an indicator as to which workspace is to be
        // dropped onto (Note - might be a handy extension).
        let newDropWorkspace = -1;
        for (let i = 0; i < this._thumbnails.length; ++i) {
            let th = this._thumbnails[i].actor;
            let [w, h] = th.get_transformed_size();
            if (x >= th.x && x <= th.x + w && y >= th.y && y <= th.y + h) {
                newDropWorkspace = i;
                break;
            }
        }
        if (newDropWorkspace !== this._dropPlaceholderPos) {
            this._dropPlaceholderPos = newDropWorkspace;
            this._dropWorkspace = newDropWorkspace;
            this.actor.queue_relayout();
        }

        if (this._dropWorkspace !== -1)
            return this._thumbnails[this._dropWorkspace].handleDragOverInternal(
                    source, time);
        else
            return DND.DragMotionResult.CONTINUE;
    },

    /* stuff to do with the indicator around the current workspace */
    set indicatorX(indicatorX) {
        this._indicatorX = indicatorX;
        //this.actor.queue_relayout(); // <-- we only ever change indicatorX
        // when we change indicatorY and that already causes a queue_relayout
        // so we omit it here so as not to have double the relayout requests..
    },

    get indicatorX() {
        return this._indicatorX;
    },

    _activeWorkspaceChanged: function () {
        let thumbnail;
        let activeWorkspace = global.screen.get_active_workspace();
        for (let i = 0; i < this._thumbnails.length; i++) {
            if (this._thumbnails[i].metaWorkspace === activeWorkspace) {
                thumbnail = this._thumbnails[i];
                break;
            }
        }

        this._animatingIndicator = true;
        let indicatorThemeNode = this._indicator.get_theme_node(),
            indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP),
            indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
        this.indicatorX = this._indicator.allocation.x1 + indicatorLeftFullBorder; // <-- added
        this.indicatorY = this._indicator.allocation.y1 + indicatorTopFullBorder;
        Tweener.addTween(this,
                         { indicatorY: thumbnail.actor.allocation.y1,
                           indicatorX: thumbnail.actor.allocation.x1, // added
                           time: WorkspacesView.WORKSPACE_SWITCH_TIME,
                           transition: 'easeOutQuad',
                           onComplete: function () {
                                this._animatingIndicator = false;
                                this._queueUpdateStates();
                            },
                           onCompleteScope: this
                         });
    },

    /**
     * The following are to get things to layout in a grid
     * Note: the mode is WIDTH_FOR_HEIGHT, and we make sure that the box is
     * no wider than MAX_SCREEN_HFRACTION fraction of the screen width wide.
     * If it is wider than MAX_SCREEN_HFRACTION_COLLAPSE then we initially
     * start the thumbnails box collapsed.
     **/
    _getPreferredHeight: function (actor, forWidth, alloc) {
        let themeNode = this.actor.get_theme_node();
        //forWidth = themeNode.adjust_for_width(forWidth);

        if (this._thumbnails.length === 0) {
            return;
        }

        let spacing = this.actor.get_theme_node().get_length('spacing'),
            nRows = global.screen.workspace_grid.rows,
            totalSpacing = (nRows - 1) * spacing,
            height = totalSpacing + nWorkspaces * this._porthole.height *
                MAX_THUMBNAIL_SCALE;

        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_height(height, height);

    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        if (this._thumbnails.length === 0) {
            return;
        }

        let themeNode = this.actor.get_theme_node(),
            spacing = this.actor.get_theme_node().get_length('spacing'),
            nRows = global.screen.workspace_grid.rows,
            nCols = global.screen.workspace_grid.columns,
            totalSpacingX = (nCols - 1) * spacing,
            totalSpacingY = (nRows - 1) * spacing,
            availY = forHeight - totalSpacingY,
            scale = (availY < 0 ? MAX_THUMBNAIL_SCALE :
                    (availY / nRows) / this._porthole.height);

        // 'scale' is the scale we need to fit `nRows` of workspaces in the
        // available height (after taking into account padding).
        scale = Math.min(scale, MAX_THUMBNAIL_SCALE);

        let width = totalSpacingX + nCols * this._porthole.width * scale,
            maxWidth = (Main.layoutManager.primaryMonitor.width *
                            settings.get_double(KEY_MAX_HFRACTION)) -
                       this.actor.get_theme_node().get_horizontal_padding() -
                       themeNode.get_horizontal_padding();
        // store the horizontal scale for use in _allocate.
        this._maxHscale = (maxWidth - totalSpacingX) / nCols / this._porthole.width;

        width = Math.min(maxWidth, width);

        // natural width is nCols of workspaces + (nCols-1)*spacingX
        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_width(width, width);
    },

    _allocate: function (actor, box, flags) {
        let rtl = (Clutter.get_default_text_direction () == Clutter.TextDirection.RTL);

        // See comment about this._background in _init()
        let themeNode = this.actor.get_theme_node();
        let contentBox = themeNode.get_content_box(box);

        if (this._thumbnails.length == 0) // not visible
            return;

        let portholeWidth = this._porthole.width;
        let portholeHeight = this._porthole.height;
        let spacing = this.actor.get_theme_node().get_length('spacing');

        // Compute the scale we'll need once everything is updated
        let nCols = global.screen.workspace_grid.columns,
            nRows = global.screen.workspace_grid.rows,
            totalSpacingY = (nRows - 1) * spacing,
            availY = (contentBox.y2 - contentBox.y1) - totalSpacingY;

        // work out what scale we need to squeeze all the rows/cols of
        // workspaces in
        let newScale = Math.min((availY / nRows) / portholeHeight,
                                MAX_THUMBNAIL_SCALE);
        if (this._maxHscale) {
            // ensure we fit horizontally too.
            newScale = Math.min(this._maxHscale, newScale);
        }

        if (newScale != this._targetScale) {
            if (this._targetScale > 0) {
                // We don't do the tween immediately because we need to observe the ordering
                // in queueUpdateStates - if workspaces have been removed we need to slide them
                // out as the first thing.
                this._targetScale = newScale;
                this._pendingScaleUpdate = true;
            } else {
                this._targetScale = this._scale = newScale;
            }

            this._queueUpdateStates();
        }

        let thumbnailHeight = portholeHeight * this._scale,
            thumbnailWidth = Math.round(portholeWidth * this._scale),
            thumbnailsWidth = thumbnailWidth * nCols + spacing * (nCols - 1);

        let childBox = new Clutter.ActorBox();

        // The background is horizontally restricted to correspond to the current thumbnail size
        // but otherwise covers the entire allocation
        if (rtl) {
            childBox.x1 = box.x1;
            childBox.x2 = box.x2 - ((contentBox.x2 - contentBox.x1) - thumbnailsWidth);
        } else {
            childBox.x1 = box.x1 + ((contentBox.x2 - contentBox.x1) - thumbnailsWidth);
            childBox.x2 = box.x2;
        }
        childBox.y1 = box.y1;
        childBox.y2 = box.y2;
//        this._background.allocate(childBox, flags);

        let indicatorY1 = this._indicatorY,
            indicatorX1 = this._indicatorX,
            indicatorY2,
            indicatorX2,
        // when not animating, the workspace position overrides this._indicatorY
            indicatorWorkspace = !this._animatingIndicator ? global.screen.get_active_workspace() : null,
            indicatorThemeNode = this._indicator.get_theme_node(),

            indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP),
            indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM),
            indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT),
            indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);


        if (this._dropPlaceholderPos == -1) {
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function() {
                this._dropPlaceholder.hide();
            }));
        }
        let dropPlaceholderPosX1,
            dropPlaceholderPosX2,
            dropPlaceholderPosY1,
            dropPlaceholderPosY2;

        // TODO: rtl.
        // Note: in theory I don't have to worry about the collapseFraction/slidePosition
        // stuff because since the number of workspaces is static, thumbnails
        // will never end up sliding in/out or collapsing
        // (when a workspace is destroyed it slides out horizontally then the
        //  space collapses vertically)
        // Hence I ignore all of the collapseFraction/slidePosition stuff.
        let y = contentBox.y1 + (availY - (nRows * thumbnailHeight)) / 2, // centre
            x = rtl ? contentBox.x1 : contentBox.x2 - thumbnailsWidth,
            i = 0;
        for (let row = 0; row < nRows; ++row) {
            // We might end up with thumbnailHeight being something like 99.33
            // pixels. To make this work and not end up with a gap at the bottom,
            // we need some thumbnails to be 99 pixels and some 100 pixels height;
            // we compute an actual scale separately for each thumbnail.
            let y1 = Math.round(y),
                y2 = Math.round(y + thumbnailHeight),
                roundedVScale = (y2 - y1) / portholeHeight;
            // reset x.
            x = rtl ? contentBox.x1 : contentBox.x2 - thumbnailsWidth;
            for (let col = 0; col < nCols; ++col) {
                let thumbnail = this._thumbnails[i];
                let x1 = Math.round(x),
                    x2 = Math.round(x + thumbnailWidth),
                    roundedHScale = (x2 - x1) / portholeWidth;

                if (thumbnail.metaWorkspace == indicatorWorkspace) {
                    indicatorY1 = y1;
                    indicatorY2 = y2;
                    indicatorX1 = x1;
                    indicatorX2 = x2;
                }

                if (i === this._dropPlaceholderPos) {
                    dropPlaceholderPosX1 = x1;
                    dropPlaceholderPosX2 = x2;
                    dropPlaceholderPosY1 = y1;
                    dropPlaceholderPosY2 = y2;
                }

                // Allocating a scaled actor is funny - x1/y1 correspond to the
                // origin of the actor, but x2/y2 are increased by the unscaled
                // size.
                childBox.x1 = x1;
                childBox.x2 = x1 + portholeWidth;
                childBox.y1 = y1;
                childBox.y2 = y1 + portholeHeight;

                thumbnail.actor.set_scale(roundedHScale, roundedVScale);
                thumbnail.actor.allocate(childBox, flags);

                x += thumbnailWidth + spacing;
                ++i;
                if (i >= MAX_WORKSPACES) {
                    break;
                }
            } // col loop
            if (i >= MAX_WORKSPACES) {
                break;
            }
            y += thumbnailHeight + spacing;
        } // row loop
        // allocate the indicator
        childBox.x1 = indicatorX1 - indicatorLeftFullBorder;
        childBox.x2 = (indicatorX2 ? indicatorX2 : (indicatorX1 + thumbnailWidth)) + indicatorLeftFullBorder;
        childBox.y1 = indicatorY1 - indicatorTopFullBorder;
        childBox.y2 = (indicatorY2 ? indicatorY2 : (indicatorY1 + thumbnailHeight)) + indicatorBottomFullBorder;
        this._indicator.allocate(childBox, flags);


        if (dropPlaceholderPosX1) {
            childBox.x1 = dropPlaceholderPosX1;
            childBox.x2 = dropPlaceholderPosX2;
            childBox.y1 = dropPlaceholderPosY1;
            childBox.y2 = dropPlaceholderPosY2;
            this._dropPlaceholder.allocate(childBox, flags);
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
                function () {
                    this._dropPlaceholder.show();
                }));
        }
    },

    destroy: function () {
        this.actor.destroy();
        let i = this._signals.length;
        while (i--) {
            Main.overview.disconnect(this._signals[i]);
        }
        this._signals = [];
        this._settings.disconnect(this._dynamicWorkspacesId);
    }
});

/* Get the thumbnails box to acknowledge a change in allowable width */
function refreshThumbnailsBox() {
    if (Main.overview.visible) {
        // we hope that when they close the overview and reopen it, that will
        // do the trick.
        // (they can't really use the prefs widget while in the overview anyway)
        return;
    }
    // get the thumbnailsbox to re-allocate itself
    Main.overview._controls._thumbnailsBox.actor.queue_relayout();
    Main.overview._controls._thumbnailsSlider.actor.queue_relayout();
}

/** Does everything in ThumbnailsBox._init to do with this.actor so that I
 * can patch it.
 * Use it like:
 *
 *     _makeNewThumbnailsBoxActor.call(whatever_is_this, ThumbnailsBox.prototype);
 *
 */
function _replaceThumbnailsBoxActor (actorCallbackObject) {
    let slider = Main.overview._controls._thumbnailsSlider,
        thumbnailsBox = Main.overview._controls._thumbnailsBox;

    // kill the old actor
    slider.actor.remove_actor(thumbnailsBox.actor);
    thumbnailsBox.actor.destroy();

    // make our own actor and slot it in to the existing thumbnailsBox.actor
    (function (patch) {
        this.actor = new Shell.GenericContainer({ reactive: true,
                                                  style_class: 'workspace-thumbnails',
                                                  request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT });
        this.actor.connect('get-preferred-width', Lang.bind(this, patch._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, patch._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, patch._allocate));
        this.actor._delegate = this;

//        this.actor.add_actor(this._background);
        this.actor.add_actor(this._indicator);
        this.actor.add_actor(this._dropPlaceholder);

        this.actor.connect('button-press-event', function() { return true; });
        this.actor.connect('button-release-event', Lang.bind(this, patch._onButtonRelease));
    }).call(thumbnailsBox, actorCallbackObject);

    thumbnailsBox.actor.y_expand = true;
    slider.actor.add_actor(thumbnailsBox.actor);
}

/**
 * We need to:
 * 1) override the scroll event on workspaces display to allow sideways
 *    scrolling too
 * 2) replace the old thumbnailsBox with our own (because you can't
 *    override ._getPreferredHeight etc that are passed in as *callbacks*).
 */
function overrideWorkspaceDisplay() {
    if (Main.overview.visible) {
        Main.overview.hide();
    }
    // 1. Override the scroll event.
    //    The _onScrollEvent function itself is quite fine, except it only allows
    //     scrolling up and down.
    //    For completeness I also allow scrolling left/right (though I can't test...)
    //    Note that this is done differently in GNOME 3.8: the event is triggered
    //     from each individual workspaces view in the workspaceDisplay rather
    //     than from the 'controls' object.
    wvStorage._init = WorkspacesView.WorkspacesView.prototype._init;
    WorkspacesView.WorkspacesView.prototype._init = function () {
        wvStorage._init.apply(this, arguments);
        this._horizontalScroll = this.actor.connect('scroll-event',
            Lang.bind(this, function () {
                // same as the original, but for LEFT/RIGHT
                if (!this.actor.mapped)
                    return false;
                switch (event.get_scroll_direction()) {
                case Clutter.ScrollDirection.LEFT:
                    Main.wm.actionMoveWorkspace(LEFT);
                    return true;
                case Clutter.ScrollDirection.RIGHT:
                    Main.wm.actionMoveWorkspace(RIGHT);
                    return true;
                }
                return false;
            }));
    };

    // 2. Replace workspacesDisplay._thumbnailsBox with my own.
    // Start with controls collapsed (since the workspace thumbnails can take
    // up quite a bit of space horizontally). This will be recalculated
    // every time the overview shows.
    // NOTE: I usually create a new instance of ThumbnailsBox() (defined above)
    // and simply replace all references to the old thumbnailsBox with this one.
    // However, the old one listens to various signals (like Main.overview's
    // 'hidden' or 'showing') that modify the thumbnailsBox actor. Since these
    // signals' IDs are not stored by gnome-shell, I can't disconnect them
    // properly, and when the signals fire they attempt to modify the now
    // non-existent/non-mapped actor, causing segfaults.

    // I will submit a patch for this against gnome-shell
    // (note to self: see https://git.gnome.org/browse/gnome-shell/commit/?id=ee4f199a9ff9f302d01393c9b6b79a0a1680db8f
    //  for how it's done), but in the meantime:
    // The only way I know how to get around it is to *leave*
    // Main.overview._thumbnailsBox as-is, but *replace* its actor with my own
    // (connected to my own _getPreferred(Width|Height) and _allocate callbacks).
    //
    // It's really really ugly, but it is a workaround and it works until
    // I submit my patch and it eventually makes it into gnome-shell.

    // replace thumbnailsBox.actor with a new one
    let MyTBProto = ThumbnailsBox.prototype,
        thumbnailsBox = Main.overview._controls._thumbnailsBox;

    _replaceThumbnailsBoxActor(MyTBProto);

    // add in the properties/functions I want.
    thumbnailsBox._indicatorX = 0;
    // patch the dropPlaceholder to show a glow around the workspace being
    // dropped on rather than the "new workspace" indicator.
    thumbnailsBox._dropPlaceholder.style_class = 'workspace-thumbnail-drop-indicator';

    tbStorage.handleDragOver = TBProto.handleDragOver;
    tbStorage._activeWorkspaceChanged = TBProto._activeWorkspaceChanged;

    TBProto.handleDragOver = MyTBProto.handleDragOver;
    TBProto._activeWorkspaceChanged = MyTBProto._activeWorkspaceChanged;
    TBProto.__defineGetter__('indicatorX', MyTBProto.__lookupGetter__('indicatorX'));
    TBProto.__defineSetter__('indicatorX', MyTBProto.__lookupSetter__('indicatorX'));

    // 3. Patch updateAlwaysZoom (now a function in OverviewControls as opposed
    //    to a property of workspaceDisplay)
    tbStorage._getAlwaysZoomOut = OverviewControls.ThumbnailsSlider.prototype._getAlwaysZoomOut;
    OverviewControls.ThumbnailsSlider.prototype._getAlwaysZoomOut = function () {
        // *Always* show the pager when hovering or during a drag, regardless of width.
        let alwaysZoomOut = this.actor.hover ||  this.inDrag;

        // always zoom out if there is a monitor to the right of primary.
        if (!alwaysZoomOut) {
            let monitors = Main.layoutManager.monitors;
            let primary = Main.layoutManager.primaryMonitor;

            /* Look for any monitor to the right of the primary, if there is
             * one, we always keep zoom out, otherwise its hard to reach
             * the thumbnail area without passing into the next monitor. */
            for (let i = 0; i < monitors.length; i++) {
                if (monitors[i].x >= primary.x + primary.width) {
                    alwaysZoomOut = true;
                    break;
                }
            }
        }

        // always zoom out if we are not too wide
        if (!alwaysZoomOut && Main.overview._controls._thumbnailsBox.actor.mapped) {
            alwaysZoomOut = Main.overview._controls._thumbnailsBox.actor.width <=
                            (Main.layoutManager.primaryMonitor.width *
                             settings.get_double(KEY_MAX_HFRACTION_COLLAPSE));
        }

        return alwaysZoomOut;
    };



    // finally refresh the box.
    refreshThumbnailsBox();
}

function unoverrideWorkspaceDisplay() {
    if (Main.overview.visible) {
        Main.overview.hide();
    }

    let wD = _getWorkspaceDisplay();
    // undo scroll event patching
    WorkspacesView.WorkspacesView.prototype._init = wvStorage._init;
    for (let i = 0; i < wD._workspacesViews.length; ++i) {
        let wV = wD._workspacesViews[i];
        if (wV._horizontalScroll) {
            wV.disconnect(wV._horizontalScroll);
        }
    }

    // 2. replace the thumbnails box actor
    // restore functions
    TBProto.handleDragOver = tbStorage.handleDragOver;
    TBProto._activeWorkspaceChanged = tbStorage._activeWorkspaceChanged;
    delete TBProto.indicatorX; // remove the getter/setter
    // replace the actor
    _replaceThumbnailsBoxActor(TBProto);
    let thumbnailsBox = Main.overview._controls._thumbnailsBox;
    thumbnailsBox._dropPlaceholder.style_class = 'placeholder';
    delete thumbnailsBox._indicatorX;
    delete thumbnailsBox._maxHscale;


    // 3. Unpatch updateAlwaysZoom
    OverviewControls.ThumbnailsSlider.prototype._getAlwaysZoomOut = tbStorage._getAlwaysZoomOut;

    refreshThumbnailsBox();
}

/******************
 * tells Meta about the number of workspaces we want
 ******************/
function modifyNumWorkspaces() {
    /// Setting the number of workspaces.
    Meta.prefs_set_num_workspaces(
        global.screen.workspace_grid.rows * global.screen.workspace_grid.columns
    );

    /* NOTE: in GNOME 3.4, 3.6, 3.8, Meta.prefs_set_num_workspaces has
     * *no effect* if Meta.prefs_get_dynamic_workspaces is true.
     * (see mutter/src/core/screen.c prefs_changed_callback).
     * To *actually* increase/decrease the number of workspaces (to fire
     * notify::n-workspaces), we must use global.screen.append_new_workspace and
     * global.screen.remove_workspace.
     *
     * We could just set org.gnome.shell.overrides.dynamic-workspaces to false
     * but then we can't drag and drop windows between workspaces (supposedly a
     * GNOME 3.4 bug, see the Frippery Static Workspaces extension. Can confirm
     * but cannot find a relevant bug report/fix.)
     * Can confirm the bug in 3.6 too.
     * In 3.8 I appear to be able to drag/drop between workspace but not to
     * drag/drop to create new workspaces (with the placeholder animation),
     * so I'll stick to this method for now.
     */
    let newtotal = (global.screen.workspace_grid.rows *
        global.screen.workspace_grid.columns);
    if (global.screen.n_workspaces < newtotal) {
        for (let i = global.screen.n_workspaces; i < newtotal; ++i) {
            global.screen.append_new_workspace(false,
                    global.get_current_time());
        }
    } else if (global.screen.n_workspaces > newtotal) {
        for (let i = global.screen.n_workspaces - 1; i >= newtotal; --i) {
            global.screen.remove_workspace(
                    global.screen.get_workspace_by_index(i),
                    global.get_current_time()
            );
        }
    }

    // This affects workspace.get_neighbor() (only exposed in 3.8+) and appears
    // to do not much else. We'll do it anyway just in case.
    global.screen.override_workspace_layout(
        Meta.ScreenCorner.TOPLEFT, // workspace 0
        false, // true == lay out in columns. false == lay out in rows
        global.screen.workspace_grid.rows,
        global.screen.workspace_grid.columns
    );

    // this forces the workspaces display to update itself to match the new
    // number of workspaces.
    global.screen.notify('n-workspaces');
}

function unmodifyNumWorkspaces() {
    // restore original number of workspaces
    Meta.prefs_set_num_workspaces(nWorkspaces);

    global.screen.override_workspace_layout(
        Meta.ScreenCorner.TOPLEFT, // workspace 0
        true, // true == lay out in columns. false == lay out in rows
        nWorkspaces,
        1 // columns
    );
}

/******************
 * This is the stuff from Frippery Static Workspaces
 ******************/
// In GNOME 3.6 and above it's possible to turn off dynamic workspaces
// using GNOME Tweak Tool or the right-click menu of the Frippery
// Bottom Panel extension. Hence this extension has been dropped.

// function dummy() { return false; }

// function makeWorkspacesStatic() {
//     /// storage
//     staticWorkspaceStorage._nWorkspacesChanged = Main._nWorkspacesChanged;
//     staticWorkspaceStorage._queueCheckWorkspaces = Main._queueCheckWorkspaces;
//     staticWorkspaceStorage._checkWorkspaces = Main._checkWorkspaces;

//     /// patching
//     Main._nWorkspacesChanged = dummy;
//     Main._queueCheckWorkspaces = dummy;
//     Main._checkWorkspaces = dummy;

//     Main.wm._workspaceTracker._workspaces.forEach(function (workspace) {
//             workspace.disconnect(workspace._windowAddedId);
//             workspace.disconnect(workspace._windowRemovedId);
//             workspace._lastRemovedWindow = null;
//         });
// }

// function unmakeWorkspacesStatic() {
//     // undo make workspaces static
//     Main._nWorkspacesChanged = staticWorkspaceStorage._nWorkspacesChanged;
//     Main._queueCheckWorkspaces = staticWorkspaceStorage._queueCheckWorkspaces;
//     Main._checkWorkspaces = staticWorkspaceStorage._checkWorkspaces;

//     Main.wm._workspaceTracker._workspaces = [];

//     // recalculate new number of workspaces.
//     Main._nWorkspacesChanged();
// }

/******************
 * Store rows/cols of workspaces, convenience functions to
 * global.screen.workspace_grid
 * such that if other extension authors want to they can use them.
 *
 * Exported constants:
 * Directions = { UP, LEFT, RIGHT, DOWN } : directions for navigating workspaces
 * rows     : number of rows of workspaces
 * columns  : number of columns of workspaces
 *
 * Exported functions:
 * rowColToIndex : converts the row/column into an index for use with (e.g.)
 *                 global.screen.get_workspace_by_index(i)
 * indexToRowCol : converts an index (0 to global.screen.n_workspaces-1) to a
 *                 row and column
 * moveWorkspace : switches workspaces in the direction specified, being either
 *                 UP, LEFT, RIGHT or DOWN (see Directions).
 ******************/
function exportFunctionsAndConstants() {
    global.screen.workspace_grid = {
        Directions: {
            UP: UP,
            LEFT: LEFT,
            RIGHT: RIGHT,
            DOWN: DOWN
        },

        rows: settings.get_int(KEY_ROWS),
        columns: settings.get_int(KEY_COLS),

        rowColToIndex: rowColToIndex,
        indexToRowCol: indexToRowCol,
        getWorkspaceSwitcherPopup: getWorkspaceSwitcherPopup,
        calculateWorkspace: calculateWorkspace,
        moveWorkspace: moveWorkspace
    };

    // It seems you can only have 36 workspaces max.
    if (settings.get_int(KEY_ROWS) * settings.get_int(KEY_COLS) >
            MAX_WORKSPACES) {
        log("WARNING [workspace-grid]: You can have at most 36 workspaces, " +
                "will ignore the rest");
        global.screen.workspace_grid.rows = Math.ceil(
                MAX_WORKSPACES / global.screen.workspace_grid.columns);
    }
}

function unexportFunctionsAndConstants() {
    delete global.screen.workspace_grid;
}

/***************************
 *         EXTENSION       *
 ***************************/

function init() {
}

function nWorkspacesChanged() {
    // re-export new rows/cols
    exportFunctionsAndConstants();
    // reset the number of workspaces
    modifyNumWorkspaces();
}

let signals = [];
function enable() {
    /// Storage
    nWorkspaces = Meta.prefs_get_num_workspaces();

    settings = Convenience.getSettings();
//    makeWorkspacesStatic();
    exportFunctionsAndConstants(); // so other extension authors can use.
    overrideKeybindingsAndPopup();
    overrideWorkspaceDisplay();
    // Main.start() gets in one call to _nWorkspacesChanged that appears to
    // be queued before any extensions enabled (so my subsequent patching
    // doesn't do anything), but takes affect *after* my `modifyNumWorkspaces`
    // call, killing all the extra workspaces I just added...
    // So we wait a little bit before caling.
    Mainloop.idle_add(modifyNumWorkspaces);

    // Connect settings change: the only one we have to monitor is cols/rows
    signals.push(settings.connect('changed::' + KEY_ROWS, nWorkspacesChanged));
    signals.push(settings.connect('changed::' + KEY_COLS, nWorkspacesChanged));
    signals.push(settings.connect('changed::' + KEY_MAX_HFRACTION, refreshThumbnailsBox));
    signals.push(settings.connect('changed::' + KEY_MAX_HFRACTION_COLLAPSE, refreshThumbnailsBox));
}

function disable() {
    unoverrideWorkspaceDisplay();
    unoverrideKeybindingsAndPopup();
    unmodifyNumWorkspaces();
    unexportFunctionsAndConstants();
//    unmakeWorkspacesStatic();

    let i = signals.length;
    while (i--) {
        settings.disconnect(signals.pop());
    }

    // just in case, let everything else get used to the new number of
    // workspaces.
    global.screen.notify('n-workspaces');
}
