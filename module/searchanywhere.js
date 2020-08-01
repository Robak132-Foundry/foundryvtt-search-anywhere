
const SEARCHABLE_ENTITY_TYPES = ['Actor','Item','JournalEntry','RollTable', 'Scene', 'Macro'];

const SUGGESTION_ICON_TYPES = {
    "Actor": 'fas fa-users',
    "Item": 'fas fa-suitcase',
    "Scene": 'fas fa-map',
    "JournalEntry": 'fas fa-book-open',
    "RollTable": 'fas fa-th-list',
    "Macro": 'fas fa-terminal',
    "COMPENDIUM": 'fas fa-atlas'
};

const SUGGESTION_KEYMAP_TYPES = {
    "Actor": 'Ctrl + t',
    "Item": 'Ctrl + i',
    "Scene": 'Ctrl + e',
    "JournalEntry": 'Ctrl + j',
    "RollTable": 'Ctrl + r',
    "Macro": 'Ctrl + m',
    "COMPENDIUM": 'fas fa-atlas'
};

Hooks.once('init', () => {

    game.settings.register('searchanywhere', 'settingKey', {
        name: 'SEARCHANYWHERE.searchKeymap',
        hint: 'SEARCHANYWHERE.searchKeymapHint',
        type: window.Azzu.SettingsTypes.KeyBinding,
        default: 'Ctrl +  ',
        scope: 'client',
        config: true
    });

    SEARCHABLE_ENTITY_TYPES.forEach(type => {
        game.settings.register('searchanywhere', `setting${type}Key`, {
            name: `SEARCHANYWHERE.search${type}Keymap`,
            hint: `SEARCHANYWHERE.search${type}KeymapHint`,
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: SUGGESTION_KEYMAP_TYPES[type],
            scope: 'client',
            config: true
        });
    });

    game.settings.register('searchanywhere', 'settingImage', {
        name: 'SEARCHANYWHERE.image',
        hint: 'SEARCHANYWHERE.imageHint',
        type: Boolean,
        default: true,
        scope: 'client',
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
});

Hooks.once('ready', () => {

    const searchField = new AutoCompletionField();
    const KeyBinding = window.Azzu.SettingsTypes.KeyBinding;

    document.onkeydown = function (evt) {
        const cmd = game.settings.get('searchanywhere', 'settingCommand');

        if (evt.key === "Escape" && (searchField.visible || CommandMenu.visible)) {
            evt.stopPropagation();
            searchField.hide();
            CommandMenu.dispose();
            return;
        }

        const stringValue = game.settings.get('searchanywhere', 'settingKey');
        const parsedValue = KeyBinding.parse(stringValue);
        const withShift = KeyBinding.parse('Shift + ' + stringValue);
        const bind = KeyBinding.eventIsForBinding(evt, parsedValue);
        const bindWithShift = KeyBinding.eventIsForBinding(evt, withShift);

        if (bind || (cmd === 'onShift' && bindWithShift)) {
            evt.stopPropagation();
            searchField.show(
                game.i18n.localize(`SEARCHANYWHERE.searchHint`),
                cmd === 'always' || (cmd === 'onShift' && bindWithShift)
            );
            return;
        }

        SEARCHABLE_ENTITY_TYPES.forEach(type => {
            const stringTypeValue = game.settings.get('searchanywhere', `setting${type}Key`);
            const parsedTypeValue = KeyBinding.parse(stringTypeValue);
            const withShiftType = KeyBinding.parse('Shift + ' + stringTypeValue);

            const bindType = KeyBinding.eventIsForBinding(evt, parsedTypeValue);
            const bindTypeWithShift = KeyBinding.eventIsForBinding(evt, withShiftType);

            if (bindType || (cmd === 'onShift' && bindTypeWithShift)) {
                evt.stopPropagation();
                searchField.show(
                    game.i18n.localize(`SEARCHANYWHERE.search${type}Hint`),
                    cmd === 'always' || (cmd === 'onShift' && bindTypeWithShift),
                    {"entityType": type }
                );
                return false;
            }
        });
    };

    window.onclick = function (evt) {
        if (evt.target === searchField.modal) {
            searchField.hide();
        }
    };

    collectSheets(CONFIG.Actor).forEach(sheetClass => new DragHandler(`render${sheetClass}`, 'Actor'));
    collectSheets(CONFIG.Item).forEach(sheetClass => new DragHandler(`render${sheetClass}`, 'Item'));
    new DragHandler('renderJournalSheet', 'JournalEntry');
});

collectSheets = function(entityType) {
    let sheetClasses = [];
    const entities = Object.values(entityType.sheetClasses);
    for (let entity of entities) {
        const entitySheets = Object.values(entity);
        for (let sheet of entitySheets) {
            const sheetClass = sheet.id.split(".")[1];
            if(!sheetClasses.includes(sheetClass)) {
                sheetClasses.push(sheetClass);
            }
        }
    }
    return sheetClasses;
};

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

    constructor(hook, type, query) {
        Hooks.on(hook, this.handle.bind(this));
        this.type = type;
    }

    handle(app, html, data) {

        const handle = $(
            `<div class="window-draggable-handle">
                <i class="fas fa-hand-rock" draggable="true"></i>
            </div>`
        );

        const header = html.parent().parent().find(".window-header");
        header.after(handle);

        const img = handle.find('i')[0];
        img.addEventListener('dragstart', evt => {
            evt.stopPropagation();
            let toTransfer;
            if(data.options.compendium) {
                let pack = game.packs.find(p => p.collection === data.options.compendium);
                toTransfer = {
                    type: pack.entity,
                    pack: pack.collection,
                    id: this.type === 'Actor' ? data.actor._id : data.entity._id
                };
            } else {
                toTransfer = {
                    type: this.type,
                    id: this.type === 'Actor' ? data.actor._id : data.entity._id
                };
            }

            evt.dataTransfer.setData("text/plain", JSON.stringify(toTransfer));
        }, false);
    }
}

class AutoCompletionField {

    constructor() {
        this._createIndex();
        this._buildHtml();
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
                    "content"
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
            '<div id="search-anywhere-modal" class="modal">' +
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

        Hooks.on('renderSceneControls', (controls, html) => {
            const searchBtn = $(
                `<li class="scene-control">
                    <i class="fas fa-search"></i>
                </li>`
            );
            html.append(searchBtn);
            searchBtn[0].addEventListener('click', evt => {
                evt.stopPropagation();
                this.show(
                    game.i18n.localize(`SEARCHANYWHERE.searchHint`),
                    true
                );
            });
        });

        SEARCHABLE_ENTITY_TYPES.forEach(entityType => {
            Hooks.on(`create${entityType}`, (entity) => {
                this.index.add(new EntitySuggestionData(entity, entityType));
            });
            Hooks.on(`update${entityType}`, (entity) => {
                this.index.update(new EntitySuggestionData(entity, entityType));
            });
            Hooks.on(`delete${entityType}`, (entity) => {
                let suggestion = this.index.find(entity.id);
                this.index.remove(suggestion);
            });
        });

        this.visible = false;
    }

    /**
     *
     * @private
     */
    _buildIndex() {
        return new Promise((resolve, reject) => {

            Loader.show("Building search indexes in progress, please wait...");

            Promise.all(game.packs.map(pack => pack.getIndex())).then(indexes => {

                let suggestions = [].concat(
                    game.actors.map(entity => new EntitySuggestionData(entity)),
                    game.items.map(entity => new EntitySuggestionData(entity)),
                    game.scenes.map(entity => new EntitySuggestionData(entity)),
                    game.journal.map(entity => new EntitySuggestionData(entity)),
                    game.tables.map(entity => new EntitySuggestionData(entity)),
                    game.macros.map(entity => new EntitySuggestionData(entity))
                );

                indexes.forEach((index, idx) => {
                    suggestions = suggestions.concat(
                        index.map(
                            entry => new CompendiumSuggestionData(entry, game.packs.entries[idx])
                        )
                    );
                });

                this.index.add(suggestions);

                this.isIndexBuilt = true;

                Loader.hide();

                resolve(true);

            }).catch(err => {
                Loader.hide();
                console.error(`Unable fetch compendium indexes: ${err}`);
                resolve(false);
            });
        });
    }

    /**
     *
     */
    rebuildIndex() {
        this.index.clear();
        this._buildIndex();
    }

    /**
     * Show the search field.
     */
    show(hint, openCmd, filter) {

        let _show = () => {
            const hideShowForPlayers = game.settings.get('searchanywhere', 'settingPlayers');
            if(hideShowForPlayers && !game.user.isGM) {
                return;
            }

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
        } else {
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
        this.state = this._whichState(query);
        this.state.lookup(query, done);
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
                field: ["value", "content"],
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
        let text = suggestion.value;
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
            ${this.suggestion.commands.map((cmd, i) =>
                `<li class="${i===0?'selected':''}" data-cmd-id="${cmd.id}"><h2>${game.i18n.localize(cmd.label)}</h2></li>`
            ).join('')}
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
            evt.stopPropagation();
            this._onDownArrow();
        }
        if(evt.which === 38) {
            evt.stopPropagation();
            this._onUpArrow();
        }
        if(evt.key === "Enter") {
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
        this.suggestion[cmdId]();
        CommandMenu.dispose();
    }

    _onClick(evt) {
        this.selected = $(evt.currentTarget);
        this._onSelect();
    }

    dispose() {
        $(window).off(".command-menu");
        $(".command-menu" ).remove();
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
        }
        return stripHtml(content);
    }

    get icon() {
        return SUGGESTION_ICON_TYPES[this.entity.entity];
    }

    get entityType() {
        return this.entity.entity;
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
        return !this.entity.img || this.entity.img === DEFAULT_TOKEN ? 'modules/searchanywhere/icons/mystery-man.svg' : this.entity.img;
    }

    allowed() {
        return this.entity.visible;
    }

    get commands() {
        let commands = [{
            id: 'render', label: 'SEARCHANYWHERE.commandOpen'
        }, {
            id: 'copy', label: 'SEARCHANYWHERE.commandCopy'
        }, {
            id: 'message', label: 'SEARCHANYWHERE.commandChat'
        }];

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

        return commands;
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
        return this.entry.name;
    }

    get data() {
        return this.entry._id;
    }

    get icon() {
        return SUGGESTION_ICON_TYPES.COMPENDIUM;
    }

    get entityType() {
        return this.pack.entity;
    }

    get collection() {
        return this.pack.metadata.label;
    }

    get image() {
        switch (this.entityType) {
            case 'JournalEntry': return 'modules/searchanywhere/icons/book.svg';
            case 'RollTable': return 'icons/svg/d20-grey.svg';
        }
        return !this.entry.img || this.entry.img === DEFAULT_TOKEN ? 'modules/searchanywhere/icons/mystery-man.svg' : this.entry.img;
    }

    allowed() {
        return game.user.isGM || !this.pack.private;
    }

    get commands() {
        let commands = [{
            id: 'render', label: 'SEARCHANYWHERE.commandOpen'
        }, {
            id: 'copy', label: 'SEARCHANYWHERE.commandCopy'
        }, {
            id: 'message', label: 'SEARCHANYWHERE.commandChat'
        }, {
            id: 'import', label: 'SEARCHANYWHERE.commandImport'
        }];

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

    render() {
        this.pack.getEntity(this.entry._id)
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
        this.pack.getEntity(this.entry._id)
            .then(entity => {
                entity.execute();
            })
            .catch(err => {
                console.error(`Unable execute compendium macro: ${err}`);
            });
    }

    roll() {
        this.pack.getEntity(this.entry._id)
            .then(entity => {
                entity.draw();
            })
            .catch(err => {
                console.error(`Unable roll compendium table: ${err}`);
            });
    }

    import() {
        this.pack.getEntity(this.entry._id)
            .then(entity => {
                const packName = entity.compendium.collection;
                entity.collection.importFromCollection(packName, entity._id);
            })
            .catch(err => {
                console.error(`Unable roll compendium table: ${err}`);
            });
    }

    _formatReference() {
        return `@Compendium[${this.pack.collection}.${this.entry._id}]{${this.entry.name}}`;
    }

}
