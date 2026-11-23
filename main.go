// Solitaire Suite desktop shell, built with MyGo (github.com/egoist/mygo).
//
// One Go program hosts every game: the game a build shows is picked by the
// app's name, which mygo.config.ts sets from SOLITAIRE_GAME (see
// scripts/app.mjs). The window loads that game's page of the Vite build,
// and the native menu forwards its items to the page as `menu` events,
// which src/shared/menu.ts dispatches to the game's actions.
package main

import (
	"log"
	"os"
	"strings"
	"sync"

	"github.com/egoist/mygo"
)

// game describes one variant: its window and the menu items it supports.
type game struct {
	key             string // directory of the page under src/, e.g. "klondike"
	name            string // the app's name, e.g. "Klondike"
	width, height   int
	minWidth        int
	minHeight       int
	hasAutoComplete bool
	hasDrawModes    bool
	hasHint         bool
}

var games = []game{
	{key: "klondike", name: "Klondike", width: 1100, height: 880, minWidth: 880, minHeight: 720, hasAutoComplete: true, hasDrawModes: true, hasHint: true},
	{key: "freecell", name: "FreeCell", width: 1180, height: 900, minWidth: 980, minHeight: 740, hasAutoComplete: true, hasHint: true},
	{key: "spider", name: "Spider", width: 1280, height: 920, minWidth: 1100, minHeight: 760, hasHint: true},
	{key: "tripeaks", name: "TriPeaks", width: 1100, height: 780, minWidth: 960, minHeight: 680, hasHint: true},
	{key: "pyramid", name: "Pyramid", width: 1024, height: 800, minWidth: 880, minHeight: 680, hasHint: true},
	{key: "hearts", name: "Hearts", width: 1180, height: 860, minWidth: 980, minHeight: 720},
}

// gameFor finds the game of the app's name ("Klondike", or "Klondike Dev"
// under mygo dev) or of SOLITAIRE_GAME, which a plain `go run .` may set.
// It defaults to Klondike.
func gameFor(appName, env string) game {
	for _, want := range []string{env, strings.TrimSuffix(appName, " Dev")} {
		for _, g := range games {
			if want != "" && (strings.EqualFold(want, g.key) || strings.EqualFold(want, g.name)) {
				return g
			}
		}
	}
	return games[0]
}

// MenuAction is a menu item the user chose. Plain items send their ID
// alone; check items also send their new state.
type MenuAction struct {
	ID      string `json:"id"`
	Checked *bool  `json:"checked,omitempty"`
}

// MenuEvent tells the page that a native menu item was chosen.
var MenuEvent = mygo.NewEvent[MenuAction]("menu")

// Menu keeps the native menu's check items in step with the game's state,
// which can also change from the game's Options dialog.
type Menu struct {
	mu           sync.Mutex
	drawOne      *mygo.MenuItem
	drawThree    *mygo.MenuItem
	autoComplete *mygo.MenuItem
}

// SyncDrawMode checks Draw One (mode 1) or Draw Three (mode 3).
func (m *Menu) SyncDrawMode(mode int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.drawOne != nil {
		m.drawOne.SetChecked(mode == 1)
	}
	if m.drawThree != nil {
		m.drawThree.SetChecked(mode == 3)
	}
}

// SyncAutoComplete checks or unchecks Auto-Complete.
func (m *Menu) SyncAutoComplete(enabled bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.autoComplete != nil {
		m.autoComplete.SetChecked(enabled)
	}
}

// build makes the menu bar of g: Game, Edit, View and Help, as the web
// build's menu bar (src/shared/WebMenuBar.tsx) has them.
func (m *Menu) build(g game) *mygo.Menu {
	send := func(item *mygo.MenuItem, win *mygo.Window) {
		action := MenuAction{ID: item.ID}
		if item.Type == mygo.MenuItemCheckbox {
			checked := item.Checked
			action.Checked = &checked
		}
		if win != nil {
			_ = MenuEvent.Emit(win, action)
		} else {
			_ = MenuEvent.Broadcast(action)
		}
	}
	item := func(id, label, accel string) *mygo.MenuItem {
		return &mygo.MenuItem{ID: id, Label: label, Accelerator: accel, Click: send}
	}

	edit := []*mygo.MenuItem{item("undo", "Undo", "CmdOrCtrl+Z")}
	if g.hasHint {
		edit = append(edit, mygo.Separator(), item("hint", "Hint", "H"))
	}
	if g.hasAutoComplete {
		m.autoComplete = &mygo.MenuItem{
			ID: "auto-complete", Label: "Auto-Complete", Accelerator: "CmdOrCtrl+A",
			Type: mygo.MenuItemCheckbox, Checked: true, Click: send,
		}
		edit = append(edit, m.autoComplete)
	}

	var view []*mygo.MenuItem
	if g.hasDrawModes {
		m.drawOne = &mygo.MenuItem{ID: "draw-1", Label: "Draw One", Type: mygo.MenuItemRadio, Checked: true, Click: send}
		m.drawThree = &mygo.MenuItem{ID: "draw-3", Label: "Draw Three", Type: mygo.MenuItemRadio, Click: send}
		view = append(view, m.drawOne, m.drawThree, mygo.Separator())
	}
	view = append(view,
		item("zoom-in", "Zoom In", "CmdOrCtrl+="),
		item("zoom-out", "Zoom Out", "CmdOrCtrl+-"),
		item("zoom-reset", "Actual Size", "CmdOrCtrl+0"),
		mygo.Separator(),
		&mygo.MenuItem{Role: mygo.RoleToggleFullScreen, Label: "Toggle Full Screen"},
	)

	return mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu}, // macOS only: About, Hide, Quit
		{Label: "Game", Submenu: []*mygo.MenuItem{
			item("new-game", "New Game", "F2"),
			item("restart", "Restart", ""),
			mygo.Separator(),
			item("stats", "Statistics...", ""),
			item("options", "Options...", ""),
			mygo.Separator(),
			{Role: mygo.RoleQuit, Label: "Exit"},
		}},
		{Label: "Edit", Submenu: edit},
		{Label: "View", Submenu: view},
		{Label: "Help", Submenu: []*mygo.MenuItem{
			item("how-to-play", "How to Play", ""),
			mygo.Separator(),
			item("about", "About "+g.name, ""),
		}},
	})
}

func main() {
	app := mygo.App
	g := gameFor(app.Name(), os.Getenv("SOLITAIRE_GAME"))

	menu := &Menu{}
	mygo.Bind(menu)

	app.WhenReady(func() {
		menu.mu.Lock()
		app.SetMenu(menu.build(g))
		menu.mu.Unlock()

		mygo.NewWindow(mygo.WindowOptions{
			Title:           g.name,
			URL:             "/" + g.key + "/",
			Width:           g.width,
			Height:          g.height,
			MinWidth:        g.minWidth,
			MinHeight:       g.minHeight,
			BackgroundColor: "#196a2a", // the felt, until the page paints
			StateKey:        "main",
		})
	})
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
