
Hooks.on('init', () => {

    let searchField = new AutoCompletionField();

    document.onkeydown = function (evt) {
        if (evt.ctrlKey && evt.keyCode === 32) {
            searchField.show();
        }
        if (evt.key === "Escape") {
            searchField.hide();
        }
    };

    window.onclick = function (evt) {
        if (evt.target === searchField.modal) {
            searchField.hide();
        }
    };
});

const SUGGESTION_ICON_TYPES = {
    "ACTOR": 'fas fa-users',
    "ITEM": 'fas fa-suitcase',
    "SCENE": 'fas fa-map',
    "JOURNAL": 'fas fa-book-open',
    "TABLE": 'fas fa-th-list',
    "COMPENDIUM": 'fas fa-atlas'
};

class AutoCompletionField {

    constructor() {
        let modalHtml =
            '<div id="search-anywhere-modal" class="modal">' +
                '<div class="modal-content">' +
                    '<input id="search-anywhere-autocomplete" type="text" placeholder="Search...">' +
                '</div>' +
            '</div>';

        $(modalHtml).appendTo($('body'));

        this.modal = document.getElementById('search-anywhere-modal');
        this.input = document.getElementById('search-anywhere-autocomplete');

        this.suggestions = [];

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
        return game.user.permission >= USER_PERMISSIONS.GAMEMASTER && this.entry.name.toLowerCase().includes(query.toLowerCase());
    }

    render() {
        this.pack.getEntity(this.entry.id)
            .then(entity => entity.sheet.render(true))
            .catch(err => {
                console.error(`Unable render compendium entity sheet: ${err}`);
            });
    }

}
