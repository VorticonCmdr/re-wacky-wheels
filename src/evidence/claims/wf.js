// Leads from subagent readouts of WW.EXE (2026-10-03). Every statement here is WF: the maintainer has not re-read the disassembly behind it, and no value may enter src/game from it.
// The reports are in docs/leads/; each element is promoted to STATIC only after the main session re-reads its routine and cites it, and to PROVEN by an observation.
export default [
  {
    id: 'hud.layout', tag: 'WF',
    statement: 'Lead: the in-race HUD is drawn by the routine obj1+0x1a92c (main) and obj1+0xdd8 (the held-item icon), called by the race frame routine just before the page flip; the labels are drawn once by obj1+0x2f80. Held-item icon: a 26x21 ICONS.SP frame at (293, 178). Speedometer: a 42x19 ICONS.SP panel at (0, 181) with two 10x15 digits at (3, 183) and (15, 183). Place digit: a 22x29 LAP.SP frame at (25, 12) inside a 38x41 label at (17, 6); labels 65x19 at (68, 6) and 61x19 at (146, 6); two-digit counter at (181, 11) and one digit at (118, 11); lap banner text at (4, 164). Minimap: a saved 78x50 picture at (0, 60) with one pixel a racer from the two halves of MAP.XY. Timer: "MM:SS:T" from GENEF.SP 7x9 glyphs at (264, 112). Split screen subtracts the word obj2+0x1ed30 (100) from y for player 2.',
    evidence: { wf: ['subagent-hud-2026-10-03'] },
    leads: ['docs/leads/hud.md', 'docs/sp.md', 'docs/xy.md'],
  },
  {
    id: 'items.behaviour', tag: 'WF',
    statement: 'Lead: kind 3 pickup is a matchbox (fireballs), 4 red discs (devils), 5 a bomb, 6 an oil can, 7 an inverted hog, kind 2 the hedgehog ammo pickups (17 sprites); the held item is the car word +0x16 and the ammo +0x6a (cap 0x63). The fire routine is obj1+0x14364, one shot a press of the word obj2+0x28b42; an item is used before ammo; with neither nothing is thrown, with ammo a hedgehog. Projectiles are queued by obj1+0x1d548 in the 0x22-byte list at obj2+0x1f2b0 (the list of view.object-projection): kind 3 three shots in a fan, kind 4 two shots sideways that bounce off walls, kinds 5 to 7 thrown backward; the pictures come from HOGMIS.SP (obj1+0x3d60). An AI racer hit stops for 0x21 ticks (ice 0x32), a human hit by ice is frozen, by type 4 steers inverted for 0x12c ticks (car word +0x14), by types 0 to 3 spins out. AI racers never fire or pick up items (a grep over callers, not a trace).',
    evidence: { wf: ['subagent-pickups-2026-10-03'] },
    leads: ['docs/leads/pickups.md', 'docs/atr.md', 'docs/spw.md'],
  },
  {
    id: 'menus.flow', tag: 'WF',
    statement: 'Lead: the program body (obj1+0x26500 to +0x26a49) shows the notice screen (CHECK.PCX, obj1+0x24458), the intro (APOG1.PCX, BEAVIS.PCX, WINTRO.PCX, obj1+0x248f4), loads the score files (obj1+0x25534) and runs the main menu loop (obj1+0xf858) with nine items (single player, two-player race, two-player shoot-out, duck shoot, COMM#BAT~, game options, info, ordering, leave); every menu goes through the routine obj1+0x55c0 (Enter or Space fire, the Up and Down flag bytes move, Esc latches obj2+0x1ecc0); after 500 idle ticks the attract mode runs. Single player: optional saved-game menu, the set-up routine obj1+0xa380 (controller, racer, class, laps, engine, zone pack), the loading card, the race obj1+0x1fd8c, the cup screen obj1+0x832c; after the race the menu obj1+0x20aae, the rostrum and leader board, name entry, and the time-trial hall of fame. Menu strings are 22-byte records from obj2+0x10b8.',
    evidence: { wf: ['subagent-menus-2026-10-03'] },
    leads: ['docs/leads/menus.md', 'docs/bin.md'],
  },
];
