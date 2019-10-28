Hooks.on('init', () => {

    let modalHtml =
        '<div id="search-anywhere-modal" class="modal">' +
            '<div class="modal-content">' +
                '<input id="search-anywhere-autocomplete" type="text" placeholder="Search...">' +
            '</div>' +
        '</div>';

    $(modalHtml).appendTo($('body'));

    let modal = document.getElementById('search-anywhere-modal');
    let input = document.getElementById('search-anywhere-autocomplete');

    document.onkeydown = function (evt) {
        if (evt.ctrlKey && evt.keyCode === 32) {
            modal.style.display = "block";
            input.value = '';
            input.focus();
        }
        if (evt.key === "Escape") {
            modal.style.display = "none";
        }
    };

    window.onclick = function (evt) {
        if (evt.target === modal) {
            modal.style.display = "none";
        }
    };

    $('#search-anywhere-autocomplete').autocomplete({
        lookup: function (query, done) {
            Promise.all(game.packs.map(pack => pack.getIndex())).then(indexes => {

                let suggestions = [].concat(
                    game.actors.entities.map(entity => new EntitySuggestionData(entity, 'ACTOR')),
                    game.items.entities.map(entity => new EntitySuggestionData(entity, 'ITEM')),
                    game.scenes.entities.map(entity => new EntitySuggestionData(entity, 'SCENE')),
                    game.journal.entities.map(entity => new EntitySuggestionData(entity, 'JOURNAL')),
                    game.tables.entities.map(entity => new EntitySuggestionData(entity, 'TABLE'))
                );

                indexes.forEach((index, idx) => {
                    suggestions = suggestions.concat(
                        index.map(
                            entry => new CompendiumSuggestionData(entry, game.packs[idx])
                        )
                    );
                });

                done({
                    suggestions: suggestions.filter(function (suggestion) {
                        return suggestion.match(query);
                    })
                });
            }).catch(unused => {
            });
        },

        formatResult: function (suggestion, value) {
            let text = $.Autocomplete.defaults.formatResult(suggestion, value);
            let icon = suggestion.icon;
            return '<span style="float: left">' + text + '</span><i class="' + icon + '" style="float: right"></i>';
        },

        onSelect: function (suggestion) {
            suggestion.render();
            modal.style.display = "none";
        }
    });
});

const SUGGESTION_ICON_TYPES = {
    "ACTOR": 'fas fa-users',
    "ITEM": 'fas fa-suitcase',
    "SCENE": 'fas fa-map',
    "JOURNAL": 'fas fa-book-open',
    "TABLE": 'fas fa-th-list',
    "COMPENDIUM": 'fas fa-atlas'
};

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
        return this.entity.visible() && this.entity.name.toLowerCase().includes(query.toLowerCase());
    }

    render() {
        this.entity.sheet.render(true);
    }

}

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
        this.pack.getEntity(this.entry.id).then(entity => entity.sheet.render(true));
    }

}
