// Global Variables

const SEARCHABLE_ENTITY_TYPES = ['Actor','Item','JournalEntry','RollTable', 'Scene', 'Macro', 'Playlist'];

const SUGGESTION_ICON_TYPES = {
    "Actor": 'fas fa-users',
    "Item": 'fas fa-suitcase',
    "Scene": 'fas fa-map',
    "JournalEntry": 'fas fa-book-open',
    "RollTable": 'fas fa-th-list',
    "Macro": 'fas fa-terminal',
    "COMPENDIUM": 'fas fa-atlas',
    "Playlist": 'fas fa-music'
};

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/**
 * Settings & initialization
 */
Hooks.once('init', () => {

    game.settings.register('searchanywhere', 'settingImage', {
      name: 'SEARCHANYWHERE.image',
      hint: 'SEARCHANYWHERE.imageHint',
      type: Boolean,
      default: true,
      scope: 'world',
      config: true
    });

    game.settings.register('searchanywhere', 'settingPlayers', {
      name: 'SEARCHANYWHERE.players',
      hint: 'SEARCHANYWHERE.playersHint',
      type: Boolean,
      default: false,
      scope: 'world',
      config: true
    });

    game.settings.register('searchanywhere', 'settingCommand', {
      name: 'SEARCHANYWHERE.command',
      hint: 'SEARCHANYWHERE.commandHint',
      type: String,
      default: "always",
      choices: {
          "always": "SEARCHANYWHERE.commandAlways",
          "onShift": "SEARCHANYWHERE.commandOnShift",
          "never": "SEARCHANYWHERE.commandNever"
      },
      scope: 'world',
      config: true
    });

    game.settings.register('searchanywhere', 'settingDragHandler', {
        name: 'SEARCHANYWHERE.dragHandler',
        hint: 'SEARCHANYWHERE.dragHandlerHint',
        type: Boolean,
        default: true,
        scope: 'world',
        config: true
    });

    /*game.settings.register('searchanywhere', 'hideToolbar', {
        name: 'SEARCHANYWHERE.hideToolbar',
        hint: 'SEARCHANYWHERE.hideToolbarHint',
        type: Boolean,
        default: false,
        scope: 'world',
        config: true
    });*/

    game.settings.register('searchanywhere', 'settingDiacritics', {
        name: 'SEARCHANYWHERE.diacritics',
        hint: 'SEARCHANYWHERE.diacriticsHint',
        type: Boolean,
        default: true,
        scope: 'world',
        config: true,
        onChange: () => {
            game.searchAnywhere.clearIndex();
        }
    });

    game.settings.register('searchanywhere', 'excludedPacks', {
        type: Array,
        default: [],
        scope: 'world',
        config: false,
        onChange: () => {
            ui.compendium.render();
            game.searchAnywhere.clearIndex();
        }
    });

    game.settings.register('searchanywhere', 'excludedFolders', {
        type: Array,
        default: [],
        scope: 'world',
        config: false,
        onChange: () => {
            ui.sidebar.render();
            game.searchAnywhere.clearIndex();
        }
    });

    const hideShowForPlayers = game.settings.get('searchanywhere', 'settingPlayers');
    if(hideShowForPlayers && !new User(game.data.users.find(user => user._id === game.data.userId)).isGM) {
        return;
    }

    const {SHIFT, CONTROL} = KeyboardManager.MODIFIER_KEYS;

    const SUGGESTION_KEYMAP_TYPES = {
        "Actor": [{
            key: "KeyT",
            modifiers: [CONTROL]
        }],
        "Item": [{
            key: "KeyI",
            modifiers: [CONTROL]
        }],
        "Scene": [{
            key: "KeyE",
            modifiers: [CONTROL]
        }],
        "JournalEntry": [{
            key: "KeyJ",
            modifiers: [CONTROL]
        }],
        "RollTable": [{
            key: "KeyR",
            modifiers: [CONTROL]
        }],
        "Macro": [{
            key: "KeyM",
            modifiers: [CONTROL]
        }],
        "Playlist": [{
            key: "KeyP",
            modifiers: [CONTROL]
        }]
    };

    game.keybindings.register('searchanywhere', 'settingKey', {
        name: game.i18n.localize('SEARCHANYWHERE.searchKeymap'),
        editable: [{
            key: "Space",
            modifiers: [CONTROL]
        }],
        reservedModifiers: [SHIFT],
        onDown: (context) => {
            const cmd = game.settings.get('searchanywhere', 'settingCommand');
            game.searchAnywhere.show(
                game.i18n.localize('SEARCHANYWHERE.searchHint'),
                cmd === 'always' || (cmd === 'onShift' && context.isShift)
            )
        },
    });

    SEARCHABLE_ENTITY_TYPES.forEach(type => {
        game.keybindings.register('searchanywhere', `setting${type}Key`, {
            name: game.i18n.localize(`SEARCHANYWHERE.search${type}Keymap`),
            editable: SUGGESTION_KEYMAP_TYPES[type],
            reservedModifiers: [SHIFT],
            onDown: (context) => {
                const cmd = game.settings.get('searchanywhere', 'settingCommand');
                game.searchAnywhere.show(
                    game.i18n.localize(`SEARCHANYWHERE.search${type}Hint`),
                    cmd === 'always' || (cmd === 'onShift' && context.isShift),
                    {"entityType": type }
                )
            },
        });
    });

    const searchField = new AutoCompletionField();
    game.searchAnywhere = searchField;

    window.onclick = function (evt) {
        if (evt.target === searchField.modal) {
            searchField.hide();
        }
    };

    /**
     * Synchronize the currently opened character sheets
     */
    Hooks.on("renderActorSheet", (sheet, html, data) => {
        game.searchAnywhere.openedSheets.set(sheet.appId, sheet);
    });

    /**
     * Synchronize the currently closed character sheets
     */
    Hooks.on("closeActorSheet", (sheet) => {
        game.searchAnywhere.openedSheets.delete(sheet.appId);
    });

    /**
     * Synchronize the currently opened roll tables
     */
    Hooks.on("renderRollTableConfig", (sheet) => {
        game.searchAnywhere.openedTables.set(sheet.appId, sheet);
    });

    /**
     * Synchronize the currently closed roll tables
     */
    Hooks.on("closeRollTableConfig", (sheet) => {
        game.searchAnywhere.openedTables.delete(sheet.appId);
    });

    /* -------------------------------------------- */

    ["Actor", "Item", "Journal"].forEach(entry => {

        /**
         * Adds a Drag & Drop handler for entity sheets
         */
        Hooks.on(`render${entry}Sheet`, (sheet, html, data) => {
            const addHandler = game.settings.get('searchanywhere', 'settingDragHandler');
            if (addHandler) {
                let entity = sheet.document.documentName;
                if (["Actor", "Item", "JournalEntry"].includes(entity)) {
                    sheet.dragHandler = new DragHandler(entity, sheet, html);
                }
            }
        });

        /**
         * Removes the Drag & Drop handler, if present
         */
        Hooks.on(`close${entry}Sheet`, (sheet) => {
            sheet.dragHandler?.dispose();
        });
    });
});

/**
 * Adds 'Toggle Searching' to the compendium directory context menu
 */
Hooks.on("getCompendiumDirectoryEntryContext", (html, entryOptions) => {

    if(!game.user.isGM) {
        return;
    }

    entryOptions.push({
        name: "SEARCHANYWHERE.toggleSearching",
        icon: "<i class=\"fas fa-search\"></i>",
        callback: (li) => {
            const pack = li.data("pack");
            const excludedPacks = game.settings.get('searchanywhere', 'excludedPacks');
            if(excludedPacks.includes(pack)) {
                const index = excludedPacks.indexOf(pack);
                if (index > -1) {
                    excludedPacks.splice(index, 1);
                }
            } else {
                excludedPacks.push(pack);
            }
            game.settings.set("searchanywhere", "excludedPacks", excludedPacks);
        }
    });
});

/**
 * Adds an excluded search icon indicator to the compendium item.
 */
Hooks.on("renderCompendiumDirectory", (dir, html) => {

    if(!game.user.isGM) {
        return;
    }

    let excludedPacks = game.settings.get('searchanywhere', 'excludedPacks');
    html.find("li.compendium-pack").each(function () {
        const pack = $(this).data("pack");
        if(excludedPacks.includes(pack)) {
            $(this).find(".status-icons").append(
                '<i class="fas fa-search-minus"></i>'
            );
        }
    })
});

/**
 * Adds 'Toggle Searching' to every folder context menu
 */
Hooks.on("getSidebarDirectoryFolderContext", (html, entryOptions) => {

    if(!game.user.isGM) {
        return;
    }

    entryOptions.push({
        name: "SEARCHANYWHERE.toggleSearching",
        icon: "<i class=\"fas fa-search\"></i>",
        callback: (header) => {
            const li = header.parent()[0];
            const folderId = li.dataset.folderId;
            const excludedFolders = game.settings.get('searchanywhere', 'excludedFolders');
            if(excludedFolders.includes(folderId)) {
                const index = excludedFolders.indexOf(folderId);
                if (index > -1) {
                    excludedFolders.splice(index, 1);
                }
            } else {
                excludedFolders.push(folderId);
            }
            game.settings.set("searchanywhere", "excludedFolders", excludedFolders);
        }
    });
});

/**
 * Adds an excluded search icon indicator to the compendium item.
 */
Hooks.on("renderSidebarDirectory", (dir, html) => {

    if(!game.user.isGM) {
        return;
    }

    const excludedFolders = game.settings.get('searchanywhere', 'excludedFolders');
    html.find("li.directory-item").each(function () {
        const folderId = $(this)[0].dataset.folderId;
        if(excludedFolders.includes(folderId)) {
            $(this).find(".folder-header:first").append(
                '<i class="fas fa-search-minus" style="flex: 0; margin: 5px 4px 0 5px;"</i>'
            );
        }
    })
});

/* -------------------------------------------- */
/*  Utilities                                   */
/* -------------------------------------------- */

copyToClipboard = function(str) {
  const el = document.createElement('textarea');
  el.value = str;
  el.setAttribute('readonly', '');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

safeGet = function(obj, path) {
  if (!obj) return null;
  if (!path) return obj;

  const splitPath = path.split('.');
  const nextObj = obj[splitPath[0]];

  if (nextObj) {
      if (splitPath.length === 1) return nextObj;

      const remainingPath = splitPath.slice(1).join('.');
      return safeGet(nextObj, remainingPath);
  }

  return null;
};

stripHtml = function(html) {
  if (!html) return "";

  return $("<div>").html(html).text();
};

function promiseAllStepN(n, list) {
  let tail = list.splice(n);
  let head = list;
  let resolved = [];
  let processed = 0;
  return new Promise(resolve=>{
      head.forEach( x => {
          let res = x();
          resolved.push(res);
          res.then(y => {
              runNext();
              return y
          })
      });
      function runNext(){
          if(processed === tail.length) {
              resolve(Promise.all(resolved))
          } else {
              resolved.push(tail[processed]().then(x=>{
                  runNext();
                  return x
              }));
              processed++
          }
      }
  })
}

Promise.allConcurrent = n => list =>  promiseAllStepN(n, list);

/* -------------------------------------------- */
/*  Main Classes                                */
/* -------------------------------------------- */

class Loader {

  static show(message) {
      const loader = $(
          `<div id="index-loader" class="loader-overlay">
              <div class="loader-container">
                  <div class="loader-spinner"></div>
                  <div class="loader-text">${message}</div>
              </div>
          </div>`
      );

      loader.appendTo($('body'));
  }

  static hide() {
      $('#index-loader').remove();
  }
}

class DragHandler {

  constructor(type, app, html) {
      this.type = type;
      this.handle(app, html);
  }

  handle(app, html) {

      const handle = $(
          `<div class="window-draggable-handle" style="z-index: 1;">
              <i class="fas fa-hand-rock" draggable="true"></i>
          </div>`
      );

      const header = html.find(".window-header");
      header.after(handle);

      const img = handle.find('i')[0];
      img.addEventListener('dragstart', evt => {
          evt.stopPropagation();
          let toTransfer = {
              type: this.type,
              pack: app.document.pack,
              id: app.document.id
          };
          evt.dataTransfer.setData("text/plain", JSON.stringify(toTransfer));
      }, false);

      function callback(mutationsList, observer) {
          mutationsList.forEach(mutation => {
              if (mutation.attributeName === 'class') {
                  if($(mutation.target).attr('class').indexOf('minimized') !== -1) {
                      handle.hide();
                  } else {
                      handle.show();
                  }
              }
          });
      }

      this.mutationObserver = new MutationObserver(callback);
      this.mutationObserver.observe(app.element[0], { attributes: true });
  }

  dispose() {
      this.mutationObserver.disconnect();
  }
}

class AutoCompletionField {

  constructor() {
      this._createIndex();
      this._buildHtml();
      this.buffer = null;
      this.openedSheets = new Map();
      this.openedTables = new Map();
      this._bindKeyEvents();
  }

  /**
   *
   * @private
   */
    _createIndex() {
        this.index = new FlexSearch({
            encode: "simple",
            tokenize: "reverse",
            cache: true,
            doc: {
                id: "data",
                field: [
                    "value",
                    "content",
                    "originalName"
                ],
                tag: "entityType"
            }
        });
    }

    /**
     *
     * @private
     */
    _buildHtml() {
        const modalHtml = $(
            '<div id="search-anywhere-modal" class="sa-modal">' +
            '<div class="modal-content">' +
            '<input id="search-anywhere-autocomplete" type="text" placeholder="Search...">' +
            '</div>' +
            '</div>'
        );

        modalHtml.appendTo($('body'));

        this.modal = document.getElementById('search-anywhere-modal');
        this.input = document.getElementById('search-anywhere-autocomplete');

        $('#search-anywhere-autocomplete').autocomplete({
            noCache: true,
            //triggerSelectOnValidInput: false,
            //preserveInput: true,
            lookup: this.lookup.bind(this),
            formatResult: this.formatResult.bind(this),
            onSelect: this.onSelect.bind(this)
        });

        this.input.addEventListener('keydown', evt => {
            if(evt.key === 'Enter') {
                this.state.processCommand(this.input.value);
            }
        });

        SEARCHABLE_ENTITY_TYPES.forEach(entityType => {
            Hooks.on(`create${entityType}`, (entity) => {
                if(!this._excluded(entity)) {
                    this.index.add(new EntitySuggestionData(entity, entityType));
                }
            });
            Hooks.on(`update${entityType}`, (entity) => {
                if(!this._excluded(entity)) {
                    this.index.update(new EntitySuggestionData(entity, entityType));
                }
            });
            Hooks.on(`delete${entityType}`, (entity) => {
                let suggestion = this.index.find(entity.id);
                if(suggestion) {
                    this.index.remove(suggestion);
                }
            });
        });

        this.visible = false;
    }

    _bindKeyEvents() {
        document.onkeydown = this._handleCommandDispose.bind(this);
        let onEditorKeyEvent = this._handleEditorEvent.bind(this);
        tinymce.PluginManager.add("searchanywhere", function (editor) {
            editor.on("keydown", function (evt) {
                onEditorKeyEvent(evt);
                game.searchAnywhere.editor = editor;
            }.bind(this));
        });
        CONFIG.TinyMCE.plugins = CONFIG.TinyMCE.plugins + " searchanywhere";
    }

    _handleCommandDispose(evt) {
        if (evt.key === "Escape" && (this.visible || CommandMenu.visible)) {
            evt.preventDefault();
            evt.stopPropagation();
            this.hide();
            CommandMenu.dispose();
        }
    }

    _handleEditorEvent(evt) {

        const context = KeyboardManager.getKeyboardEventContext(evt);
        let possibleMatches = game.keybindings.activeKeys.get(context.key) || [];
        const matches = possibleMatches.filter(action =>
            action.action.startsWith("searchanywhere") && KeyboardManager._testContext(action, context));

        if(matches.length === 1) {
            KeyboardManager._executeKeybind(matches[0], context);
            evt.preventDefault();
            evt.stopPropagation();
        }
    }

    /**
     *
     * @private
     */
    _buildIndex() {
        this.indexBuilding = true;
        return new Promise((resolve, reject) => {

            Loader.show(game.i18n.localize(`SEARCHANYWHERE.waitMessage`));

            const excludedPacks = game.settings.get('searchanywhere', 'excludedPacks');
            const packs = game.packs.filter(pack => !excludedPacks.includes(pack.collection));
            Promise.allConcurrent(10)(packs.map(pack => () => pack.getIndex())).then(indexes => {

                let entities = [].concat(
                    game.actors.contents,
                    game.items.contents,
                    game.scenes.contents,
                    game.journal.contents,
                    game.tables.contents,
                    game.macros.contents,
                    game.playlists.contents
                )

                let suggestions = entities
                    .filter(entity => !this._excluded(entity) && entity.visible)
                    .map(entity => new EntitySuggestionData(entity));

                indexes.forEach((index, idx) => {
                    suggestions = suggestions.concat(
                        index.map(
                            entry => new CompendiumSuggestionData(entry, packs[idx])
                        )
                    );
                });

                this.index.add(suggestions);

                this.indexBuilding = false;
                this.isIndexBuilt = true;

                Loader.hide();

                resolve(true);

            }).catch(err => {
                this.indexBuilding = false;
                Loader.hide();
                console.error(`Unable fetch compendium indexes: ${err}`);
                resolve(false);
            });
        });
    }

    /**
     * Recursively search if the entity belongs to an excluded folder.
     *
     * @param entity
     * @returns {boolean}
     * @private
     */
    _excluded(entity) {
        const excludedFolders = game.settings.get('searchanywhere', 'excludedFolders');
        let excluded = false;
        let folder = entity.folder;
        while (folder !== null && !excluded) {
            excluded = excludedFolders.includes(folder.id);
            folder = folder.data.parent ? game.folders.get(folder.data.parent) : null;
        }
        return excluded;
    }

    /**
     *
     */
    clearIndex() {
        this.index.clear();
        this._createIndex();
        this.isIndexBuilt = false;
    }

    /**
     * Show the search field.
     */
    show(hint, openCmd, filter) {

        canvas.activeLayer?.releaseAll();

        let _show = () => {
            this.modal.style.display = "block";
            this.input.value = '';
            this.input.focus();
            this.visible = true;
            this.filter = filter;
            this.openCmd = openCmd;
            $('#search-anywhere-autocomplete').attr("placeholder", hint);
        };

        if(this.isIndexBuilt) {
            _show();
        } else if(!this.indexBuilding) {
            this._buildIndex().then(built => {
                _show();
            });
        }
    }

    /**
     * Discard the cached data and hide the modal search field.
     */
    hide() {
        this.modal.style.display = "none";
        this.visible = false;
        this.filter = null;
    }

    /**
     *
     * @param query
     * @param done
     */
    lookup(query, done) {

        if(this.buffer) {
            clearTimeout(this.buffer);
        }

        if (!game.settings.get('searchanywhere', 'settingDiacritics')) {
            query = query.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
        }

        let doLookup = () => {
            this.state = this._whichState(query);
            this.state.lookup(query, done);
            this.buffer = null;
        };

        this.buffer = setTimeout(doLookup, 300);
    }

    /**
     *
     * @param suggestion
     * @param value
     * @returns {string}
     */
    formatResult(suggestion, value) {
        return this.state.formatResult(suggestion, value);
    }

    /**
     *
     * @param suggestion
     */
    onSelect(suggestion) {
        this.state.onSelect(suggestion);
    }

    /**
     *
     * @param query
     * @private
     */
    _whichState(query) {
        return query.startsWith('/') ? new CommandState(this) : new SearchState(this);
    }

}

class SearchState {

    constructor(searchField) {
        this.field = searchField;
    }

    /**
     *
     * @param query
     * @param done
     */
    lookup(query, done) {
        done({
            suggestions: this.field.index.search(query, {
                field: ["value", "content", "originalName"],
                where: this.field.filter ? this.field.filter : undefined

            }).filter(suggestion => suggestion.allowed())
        });
    }

    /**
     *
     * @param suggestion
     * @param value
     * @returns {string}
     */
    formatResult(suggestion, value) {
        let text = suggestion.name;
        let icon = suggestion.icon;
        let image = suggestion.image;
        let entityType = game.i18n.localize(`SEARCHANYWHERE.desc${suggestion.entityType}`);
        let collection = suggestion.collection;
        let showImage = game.settings.get('searchanywhere', 'settingImage');
        let imageDiv = showImage ? `<div class="thumbnail" style="background-image: url(${image});"></div>` : '';
        let suggestionDiv = `<div class="suggestion ${showImage?'':'span'}">${text}</div>`;
        let infoDiv = `<div class="info">${entityType} - ${collection} <i class="${icon}" style="width: 20px"></i></div>`;
        return `${imageDiv}${suggestionDiv}${infoDiv}`;
    }

    /**
     *
     * @param suggestion
     */
    onSelect(suggestion) {
        this.field.hide();
        if(this.field.openCmd) {
            CommandMenu.create(suggestion);
        } else {
            suggestion.render();
        }
    }

    /**
     *
     * @param command
     */
    processCommand(command) {

    }
}

class CommandState {

    constructor(searchField) {
        this.field = searchField;
    }

    static get commands() {
        return [{
            value: '/ic',
            data: '/ic'
        }, {
            value: '/ooc',
            data: '/ooc'
        }, {
            value: '/emote',
            data: '/emote'
        }, {
            value: '/whisper',
            data: '/whisper'
        }, {
            value: '/roll',
            data: '/roll'
        }, {
            value: '/gmroll',
            data: '/gmroll'
        }, {
            value: '/blindroll',
            data: '/blindroll'
        }, {
            value: '/selfroll',
            data: '/selfroll'
        }];
    }

    /**
     *
     * @param query
     * @param done
     */
    lookup(query, done) {
        done({
            suggestions: CommandState.commands.filter(cmd => cmd.value.includes(query.toLowerCase()))
        });
    }

    /**
     *
     * @param suggestion
     * @param value
     * @returns {string}
     */
    formatResult(suggestion, value) {
        return `<div class="suggestion">${suggestion.value}</div>`;
    }

    /**
     *
     * @param suggestion
     */
    onSelect(suggestion) {
    }

    /**
     *
     * @param message
     */
    processCommand(message) {
        let [command, match] = ChatLog.parse(message);
        if(match) {
            ui.chat.processMessage(message).then(() => {
                this.field.hide();
            }).catch(error => {
                ui.notifications.error(error);
                throw error;
            });
        }
    }
}

/**
 * Command list popup window.
 */
class CommandMenu {

    static create(suggestion) {
        CommandMenu.instance = new CommandMenu(suggestion);
    }

    static dispose() {
        if(CommandMenu.instance) {
            CommandMenu.instance.dispose();
            CommandMenu.instance = null;
        }
    }

    static get visible() {
        return CommandMenu.instance;
    }

    constructor(suggestion) {
        this.suggestion = suggestion;
        this._buildHtml();
    }

    _buildHtml() {
        const html = $(
            `<ul class="command-menu">
            ${this.suggestion.commands.map((cmd, i) => {
                let label;
                if(cmd.label.indexOf(":")) {
                    let value = cmd.label.split(":");
                    label = game.i18n.format(value[0], { value: value[1]});
                } else {
                    label = game.i18n.localize(cmd.label);
                }
                return `<li class="${i===0?'selected':''}" data-cmd-id="${cmd.id}"><h2>${label}</h2></li>`
            }).join('')}
            </ul>`
        );
        html.appendTo($('body'));

        $(window).on("keydown.command-menu", this._onKeyDown.bind(this));
        $('.command-menu li').click(this._onClick.bind(this));

        this.selected = $('li.selected');
        $(".command-menu").show();
    }

    _onKeyDown(evt) {
        if(evt.which === 40) {
            evt.preventDefault();
            evt.stopPropagation();
            this._onDownArrow();
        }
        if(evt.which === 38) {
            evt.preventDefault();
            evt.stopPropagation();
            this._onUpArrow();
        }
        if(evt.key === "Enter") {
            evt.preventDefault();
            evt.stopPropagation();
            this._onSelect();
        }
    }

    _onDownArrow() {
        let next = this.selected.next();
        if(next.length > 0){
            this.selected.removeClass('selected');
            this.selected = next.addClass('selected');
        }
    }

    _onUpArrow() {
        let prev = this.selected.prev();
        if(prev.length > 0){
            this.selected.removeClass('selected');
            this.selected = prev.addClass('selected');
        }
    }

    _onSelect() {
        const cmdId = this.selected.attr('data-cmd-id');
        if(cmdId.indexOf(":")) {
            let cmd = cmdId.split(":");
            this.suggestion[cmd[0]](cmd[1]);
        } else {
            this.suggestion[cmdId]();
        }
        CommandMenu.dispose();
    }

    _onClick(evt) {
        this.selected = $(evt.currentTarget);
        this._onSelect();
    }

    dispose() {
        $(window).off(".command-menu");
        $(".command-menu" ).remove();
        game.searchAnywhere.editor = null;
    }

}

/**
 * Suggestion data representing a Entity type.
 */
class EntitySuggestionData {

    constructor(entity) {
        this.entity = entity;
    }

    get value() {
        return this.entity.name;
    }

    get data() {
        return this.entity.id;
    }

    get content() {
        let content = '';
        switch (this.entityType) {
            case 'Actor': content = safeGet(this.entity, 'data.data.details.biography.value'); break;
            case 'Item': content = safeGet(this.entity, 'data.data.description.value'); break;
            case 'JournalEntry': content = safeGet(this.entity, 'data.content'); break;
            case 'RollTable': content = safeGet(this.entity, 'data.content'); break;
            case 'Playlist': content = safeGet(this.entity, 'data.description'); break;
        }
        return stripHtml(content);
    }

    get icon() {
        return SUGGESTION_ICON_TYPES[this.entity.documentName];
    }

    get entityType() {
        return this.entity.documentName;
    }

    get collection() {
        return 'World';
    }

    get image() {
        switch (this.entityType) {
            case 'Macro': return this.entity.data.img;
            case 'JournalEntry': return 'modules/searchanywhere/icons/book.svg';
            case 'RollTable': return 'icons/svg/d20-grey.svg';
        }
        return !this.entity.img || this.entity.img === CONST.DEFAULT_TOKEN ? 'modules/searchanywhere/icons/mystery-man.svg' : this.entity.img;
    }

    allowed() {
        return this.entity.visible;
    }

    get commands() {
        let commands = [];

        if(game.searchAnywhere.editor) {
            commands.push({
                id: `toEditor`, label: `SEARCHANYWHERE.commandToEditor`
            })
        }

        if(this.entityType === "Item") {
            game.searchAnywhere.openedSheets.forEach((value, key) => {
                commands.push({
                    id: `toSheet:${key}`, label: `SEARCHANYWHERE.commandToSheet:${value.actor.name}`
                })
            });
        }

        game.searchAnywhere.openedTables.forEach((value, key) => {
            commands.push({
                id: `toTable:${key}`, label: `SEARCHANYWHERE.commandToTable:${value.document.name}`
            })
        });

        commands.push({
            id: 'render', label: 'SEARCHANYWHERE.commandOpen'
        });

        if(this.entityType !== "Playlist") {
            commands.push({
                id: 'copy', label: 'SEARCHANYWHERE.commandCopy'
            });
            commands.push({
                id: 'message', label: 'SEARCHANYWHERE.commandChat'
            });
        }

        if(this.entityType === 'Macro') {
            commands.push({
                id: 'execute', label: 'SEARCHANYWHERE.commandExecute'
            });
        }

        if(this.entityType === 'Scene') {
            commands.push({
                id: 'activate', label: 'SEARCHANYWHERE.commandActivate'
            });
            commands.push({
                id: 'configure', label: 'SEARCHANYWHERE.commandConfigure'
            });
            commands.push({
                id: 'openNote', label: 'SEARCHANYWHERE.commandNote'
            });
        }

        if(this.entityType === 'RollTable') {
            commands.push({
                id: 'roll', label: 'SEARCHANYWHERE.commandRoll'
            });
        }

        if(this.entityType === 'Playlist') {
            if(this.entity.playing) {
                commands.push({
                    id: 'stop', label: 'SEARCHANYWHERE.commandStop'
                });
            } else {
                commands.push({
                    id: 'play', label: 'SEARCHANYWHERE.commandPlay'
                });
            }
        }

        return commands;
    }

    toEditor() {
        let editor = game.searchAnywhere.editor;
        if(editor) {
            editor.insertContent(this._formatReference());
            editor.focus();
        }
    }

    toSheet(sheetTd) {
        let sheet = game.searchAnywhere.openedSheets.get(parseInt(sheetTd));
        sheet.actor.createEmbeddedDocuments("Item", [this.entity.data.toJSON()]);
    }

    toTable(sheetTd) {
        let sheet = game.searchAnywhere.openedTables.get(parseInt(sheetTd));
        let fakeEvt = { preventDefault: function() {}};
        sheet._onCreateResult(fakeEvt, {
            type: CONST.TABLE_RESULT_TYPES.ENTITY,
            collection: this.entity.entity,
            text: this.entity.name,
            resultId: this.entity.id,
            img: this.entity.data.img || null
        });
    }

    render() {
        if(this.entityType === 'Scene') {
            this.entity.view();
        } else {
            this.entity.sheet.render(true);
        }
    }

    copy() {
        copyToClipboard(this._formatReference());
        ui.notifications.info(game.i18n.localize("SEARCHANYWHERE.copyMessage"));
    }

    message() {
        ChatMessage.create({
            "content": this._formatReference()
        });
    }

    execute() {
        this.entity.execute();
    }

    activate() {
        this.entity.activate();
    }

    openNote() {
        if(!this.entity.journal) {
            ui.notifications.warn(game.i18n.localize("SEARCHANYWHERE.noJournalNote"));
            return;
        }
        this.entity.journal.sheet.render(true);
    }

    configure() {
        this.entity.sheet.render(true);
    }

    roll() {
        this.entity.draw();
    }

    play() {
        this.entity.playAll();
    }

    stop() {
        this.entity.stopAll();
    }

    _formatReference() {
        return `@${this.entityType}[${this.entity.id}]{${this.entity.name}}`;
    }

}

/**
 * Suggestion data representing a Compendium type.
 */
class CompendiumSuggestionData {

    constructor(entry, pack) {
        this.entry = entry;
        this.pack = pack;
    }

    get value() {
        return game.settings.get('searchanywhere', 'settingDiacritics') ? this.entry.name : this.entry.name.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
    }

    get name() {
        return this.entry.name;
    }

    get originalName() {
        return this.entry.originalName;
    }

    get data() {
        return this.entry._id;
    }

    get icon() {
        return SUGGESTION_ICON_TYPES.COMPENDIUM;
    }

    get entityType() {
        return this.pack.documentClass.documentName;
    }

    get collection() {
        return this.pack.metadata.label;
    }

    get image() {
        switch (this.entityType) {
            case 'JournalEntry': return 'modules/searchanywhere/icons/book.svg';
            case 'RollTable': return 'icons/svg/d20-grey.svg';
        }
        return !this.entry.img || this.entry.img === CONST.DEFAULT_TOKEN ? 'modules/searchanywhere/icons/mystery-man.svg' : this.entry.img;
    }

    allowed() {
        return game.user.isGM || !this.pack.private;
    }

    get commands() {

        let commands = [];

        if(game.searchAnywhere.editor) {
            commands.push({
                id: `toEditor`, label: `SEARCHANYWHERE.commandToEditor`
            })
        }

        if(this.entityType === "Item") {
            game.searchAnywhere.openedSheets.forEach((value, key) => {
                commands.push({
                    id: `toSheet:${key}`, label: `SEARCHANYWHERE.commandToSheet:${value.actor.name}`
                })
            });
        }

        game.searchAnywhere.openedTables.forEach((value, key) => {
            commands.push({
                id: `toTable:${key}`, label: `SEARCHANYWHERE.commandToTable:${value.document.name}`
            })
        });

        commands.push({
            id: 'render', label: 'SEARCHANYWHERE.commandOpen'
        });
        commands.push({
            id: 'copy', label: 'SEARCHANYWHERE.commandCopy'
        });
        commands.push({
            id: 'message', label: 'SEARCHANYWHERE.commandChat'
        });
        commands.push({
            id: 'import', label: 'SEARCHANYWHERE.commandImport'
        });

        if(this.entityType === 'Macro') {
            commands.push({
                id: 'execute', label: 'SEARCHANYWHERE.commandExecute'
            });
        }

        if(this.entityType === 'RollTable') {
            commands.push({
                id: 'roll', label: 'SEARCHANYWHERE.commandRoll'
            });
        }

        return commands;
    }

    toEditor() {
        let editor = game.searchAnywhere.editor;
        if(editor) {
            editor.insertContent(this._formatReference());
            editor.focus();
        }
    }

    toSheet(sheetTd) {
        this.pack.getDocument(this.entry._id)
            .then(entity => {
                let sheet = game.searchAnywhere.openedSheets.get(parseInt(sheetTd));
                sheet.actor.createEmbeddedDocuments("Item", [entity.data.toJSON()]);
            })
            .catch(err => {
                console.error(`Unable to add compendium item to sheet: ${err}`);
            });
    }

    toTable(sheetTd) {
        this.pack.getDocument(this.entry._id)
            .then(entity => {
                let sheet = game.searchAnywhere.openedTables.get(parseInt(sheetTd));
                let fakeEvt = { preventDefault: function() {}};
                sheet._onCreateResult(fakeEvt, {
                    type: CONST.TABLE_RESULT_TYPES.COMPENDIUM,
                    collection: this.pack.collection,
                    text: entity.name,
                    resultId: entity.id,
                    img: entity.data.img || null
                });
            })
            .catch(err => {
                console.error(`Unable to add compendium item to sheet: ${err}`);
            });
    }

    render() {
        this.pack.getDocument(this.entry._id)
            .then(entity => {
                const sheet = entity.sheet;
                sheet.options.editable = false;
                sheet.options.compendium = this.pack.collection;
                sheet.render(true);
            })
            .catch(err => {
                console.error(`Unable render compendium entity sheet: ${err}`);
            });
    }

    copy() {
        copyToClipboard(this._formatReference());
        ui.notifications.info(game.i18n.localize("SEARCHANYWHERE.copyMessage"));
    }

    message() {
        ChatMessage.create({
            "content": this._formatReference()
        });
    }

    execute() {
        this.pack.getDocument(this.entry._id)
            .then(entity => {
                entity.execute();
            })
            .catch(err => {
                console.error(`Unable execute compendium macro: ${err}`);
            });
    }

    roll() {
        this.pack.getDocument(this.entry._id)
            .then(entity => {
                entity.draw();
            })
            .catch(err => {
                console.error(`Unable roll compendium table: ${err}`);
            });
    }

    import() {
        this.pack.getDocument(this.entry._id)
            .then(entity => {
                entity.collection.importFromCompendium(this.pack, entity.id);
            })
            .catch(err => {
                console.error(`Unable roll compendium table: ${err}`);
            });
    }

    _formatReference() {
        return `@Compendium[${this.pack.collection}.${this.entry._id}]{${this.entry.name}}`;
    }

}
