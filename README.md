# FoundryVTT Search Anywhere

A FoundryVTT Module that adds a way to quickly search for any entity by name via a handy auto-complete widget.

![Preview](/preview.gif?raw=true)

Currently supports searchs over: 

*  Actors (characters and NPCs)
*  Items
*  Scenes
*  Journal
*  Rollable tables
*  Compendium

## From version 1.1: Added the ability to drag the entity directly from the window!

The module adds a small drag handler in the lower left corner of the window that allows to drag and drop directly from the opened sheet.

![Preview](/preview-1.1..gif?raw=true)

## From version 2.0:

- Significant performance increase via flexsearch indexing, even in worlds with huge amount of data.
- Search by multiple words, order independent.

![Preview](/multiple-word-search.gif?raw=true)

- Full text content search inside Journal Entries, Item description, Actor bio & Rollable Table description (world's entity only)
- Better indication of the source of the suggestion (compendium/type).
- Thumbnail image preview (where present).
- Type-filtered search binded with specific keymap (fully customizable in the settings). Ex. press 'Ctrl + m' to Macro only search. 
- Multiple choice of commands at the entity selection:

![Preview](/command-window.gif?raw=true)

	- open: open the entity sheet (for scenes, the scene itself is displayed)
	- copy reference: clipboard copy of the entity reference. 
	- send reference in chat: create a chat message with the entity reference.
	- execute: only for Macro, runs the macro.
	- roll: only for Rollable Tables, roll the table and diplay the result in chat.
	- activate: only for Scenes
	- configure: only for Scenes, open the configuration sheet of the scene.
	- open journal Note: only for Scenes, open the associated Journal Note.
	- import: only for compendium entities, directly imports the selected entity in the world.
	
![Preview](/import.gif?raw=true)	

- Execute chat commands directly from the search: type '/' and see what commands you can execute. 

![Preview](/roll-dice.gif?raw=true)

- Disable search for players.	
- Internationalization support.  

## Installation

To install, follow these instructions:

1.  Inside Foundry, select the Game Modules tab in the Configuration and Setup menu.
2.  Click the Install Module button and enter the following URL: https://gitlab.com/riccisi/foundryvtt-search-anywhere/raw/master/module/module.json
3.  Click Install and wait for installation to complete

## Usage Instructions

Hit <kbd>ctrl</kbd> + <kbd>space</kbd> and start typing. Select an entry using <kbd>up</kbd>/<kbd>down</kbd> arrow keys and hit <kbd>enter</kbd> to show the selected sheet. 

## Compatibility

Tested on 0.3.9 version.

## Feedback

Every suggestions/feedback are appreciated, if so, please contact me on discord (Simone#6710)

## License

FoundryVTT Search Anywhere is a module for Foundry VTT by Simone and is licensed under a [Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/).

This work is licensed under Foundry Virtual Tabletop [EULA - Limited License Agreement for module development v 0.1.6](http://foundryvtt.com/pages/license.html).