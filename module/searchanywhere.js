
Hooks.on('init', () => {

    const searchField = new AutoCompletionField();

    document.onkeydown = function (evt) {
        const stringValue = game.settings.get('searchanywhere', 'settingKey');
        const parsedValue = window.Azzu.SettingsTypes.KeyBinding.parse(stringValue);
        if (window.Azzu.SettingsTypes.KeyBinding.eventIsForBinding(evt, parsedValue)) {
            evt.stopPropagation();
            searchField.show();
        }
        if (evt.key === "Escape" && searchField.visible) {
            evt.stopPropagation();
            searchField.hide();
        }
    };

    window.onclick = function (evt) {
        if (evt.target === searchField.modal) {
            searchField.hide();
        }
    };

    game.settings.register('searchanywhere', 'settingKey', {
        name: 'Keymap',
        hint: 'Enter the keymap used to display the search bar',
        type: window.Azzu.SettingsTypes.KeyBinding,
        default: 'Ctrl +  ',
        scope: 'client',
        config: true
    });
});

Hooks.on('ready', () => {

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

const SUGGESTION_ICON_TYPES = {
    "ACTOR": 'fas fa-users',
    "ITEM": 'fas fa-suitcase',
    "SCENE": 'fas fa-map',
    "JOURNAL": 'fas fa-book-open',
    "TABLE": 'fas fa-th-list',
    "COMPENDIUM": 'fas fa-atlas'
};

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

        this.suggestions = [];
        this.visible = false;

        let me = this;

        $('#search-anywhere-autocomplete').autocomplete({
            lookup: function (query, done) {
                done({
                    suggestions: me.suggestions.filter(
                        function (suggestion) {
                            return suggestion.match(query);
                        }
                    )
                });
            },

            formatResult: function (suggestion, value) {
                let text = $.Autocomplete.defaults.formatResult(suggestion, value);
                let icon = suggestion.icon;
                return '<span style="float: left">' + text + '</span><i class="' + icon + '" style="float: right"></i>';
            },

            onSelect: function (suggestion) {
                suggestion.render();
                me.hide();
            }
        });

        this.input.addEventListener('keydown', evt => {
            if(evt.key === 'Enter') {
                let [command, match] = ChatLog.parse(this.input.value);
                if(match) {
                    ui.chat._processMessageData(this.input.value).then(() => {
                        this.hide();
                    }).catch(error => {
                        ui.notifications.error(error);
                        throw error;
                    });
                }
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
                this.show();
            });
        });
    }

    /**
     * Fetch the entire results collecting all the data and then show the search field.
     */
    show() {
        Promise.all(game.packs.map(pack => pack.getIndex())).then(indexes => {

            this.suggestions = [].concat(
                game.actors.entities.map(entity => new EntitySuggestionData(entity, 'ACTOR')),
                game.items.entities.map(entity => new EntitySuggestionData(entity, 'ITEM')),
                game.scenes.entities.map(entity => new EntitySuggestionData(entity, 'SCENE')),
                game.journal.entities.map(entity => new EntitySuggestionData(entity, 'JOURNAL')),
                game.tables.entities.map(entity => new EntitySuggestionData(entity, 'TABLE'))
            );

            indexes.forEach((index, idx) => {
                this.suggestions = this.suggestions.concat(
                    index.map(
                        entry => new CompendiumSuggestionData(entry, game.packs[idx])
                    )
                );
            });

            this.modal.style.display = "block";
            this.input.value = '';
            this.input.focus();
            this.visible = true;

        }).catch(err => {
            console.error(`Unable fetch compendium indexes: ${err}`);
        });
    }

    /**
     * Discard the cached data and hide the modal search field.
     */
    hide() {
        this.suggestions = [];
        this.modal.style.display = "none";
        this.visible = false;
    }

}

/**
 * Suggestion data representing a Entity type.
 */
class EntitySuggestionData {

    constructor(entity, type) {
        this.entity = entity;
        this.type = type;
    }

    get value() {
        return this.entity.name;
    }

    get data() {
        return this.entity.id;
    }

    get icon() {
        return SUGGESTION_ICON_TYPES[this.type];
    }

    match(query) {
        return this.entity.visible && this.entity.name.toLowerCase().includes(query.toLowerCase());
    }

    render() {
        this.entity.sheet.render(true);
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
        return this.entry.id;
    }

    get icon() {
        return SUGGESTION_ICON_TYPES.COMPENDIUM;
    }

    match(query) {
        return (game.user.isGM || !this.pack.private) && this.entry.name.toLowerCase().includes(query.toLowerCase());
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

}
