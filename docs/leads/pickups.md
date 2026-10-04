<!-- WF: output of a subagent's read of the disassembly on 2026-10-03; a lead, not evidence. The maintainer has not re-read it. Citations inside were produced by the subagent and are re-hashed by nothing until a claim cites them. -->

> **Checked 2026-10-03 against the running game** (`pickup.kinds-observed`, PROVEN, records pickup-1, pickup-2, hudicon-1): a kind-2 pickup (hedgehog, sprite 1) sets the object's consumed marker 0xffff and raises the car's counter word +0x6a from 0 to 4; a kind-3 pickup (sprite 0, H1) sets the held word +0x16 to 3 and leaves the counter at 0; neither slows or turns the car; with the item 3 held the icon is ICONS.SP frame 0 at (293, 178). Also checked (`item.fire-observed`, PROVEN, record fire-1): firing the held item 3 uses it up and spawns 3 shots in a fan (offsets 0, +2 and -2 sideways at the start, drifting 10 for every 100 of travel), each state of the list 100 units farther, the in-flight word obj2+0xaaa2 is 3 while they fly, the travel counter ends at 1010 against the limit word 1000, and a second press with nothing held spawns nothing. Also checked (`item.shots-observed`, PROVEN, record fire-2): the kinds 4, 5, 6 and 7 are picked up in turn (the held word is the kind) and each press uses the item up; kind 4 makes two type-1 records that start 32 either side of the car's column, move 16 a state east and west and turn round at the sides of the road (columns 1056 and 1456); kinds 5, 6 and 7 each leave one record of the types 2, 3 and 4 on the road 10 rows behind the car, which never moves again. Also checked (`item.hedgehog-observed`, PROVEN, record hedgehog-1): a press with nothing held spends one count of the hedgehog counter (+0x6a) and queues one type-0 record 20 rows ahead of the car; a shot touching an object (the kind-1 tyre stack) stops 13 rows before it, sets the collision word 2 and is gone a few samples later, otherwise it goes on to the end of the road (travel 610 there); holding the fire key for 25 samples fires once and gave no item. Also checked (`pickup.tyres-observed`, PROVEN, record tyres-1): a kind-1 tyre stack is consumed on touch, the word obj2+0x28c8c runs 1, 2, 3, 0 over 18 samples and the three words at obj2+0x20ae8 slide from (128, 149, 170) to (199, 199, 177); the car is not touched. Also checked (`item.mine-hit-observed`, PROVEN, record mine-1): a dropped bomb (type 2) is hit by an AI racer coming round behind the stopped player: the racer's word +0x58 becomes 1 and its dword +0x4c the tick (137), it stands still 5 units from the record for 33 (0x21) ticks, then drives on; the record is gone 3 ticks after the hit. Not yet checked: the oil and inverted-hog hits, the ice item (the report's 20-tick hold did not give it within the hold), a shot hitting a racer, the effects on a human car.

# Pickups and held items (WF lead, 2026-10-03)

Everything here is WF: read from the disassembly (`npm run -s disasm`, plus a grep over /private/tmp/obj1.dis = `ndisasm -b 32 analysis/ww/obj1.bin`), nothing was run. Offsets `obj1+0x...` are code offsets, bare `0x28b42`-style operands are obj2 offsets. "Inferred" marks anything not read directly. Sprite names come from SPRITE.ATR + a contact sheet rendered from the SP frames (palette from SHRINK1.PCX, only for looking; colours not authoritative).

## 0. Catalogue (SPRITE.ATR in game/WackyWhe/WACKY/WACKY.DAT; word +0 = kind)

| id | file | kind | size x frames | what it looks like (rendered, inferred) |
|---|---|---|---|---|
| 0 | H1.SP | 3 | 32x24 x2 | matchbox with flame icon + yellow glove |
| 1-9, 11, 14-16, 18-22 | H2,H4,H5,H7,H6,H8,H9,H10,H11,H14,H17,H18,H19,H21,H22,H23,H24 | 2 | 32x24 x2..7 | 17 different animated hedgehog poses (reading paper, on toilet, with wand, with fork, ...) |
| 10 | H12.SP | 5 | x2 | black round bomb + glove |
| 12 | H15.SP | 4 | x2 | red disc + glove ("devil", wiki name) |
| 13 | H16.SP | 6 | x2 | blue "OIL" can + glove |
| 17 | H20.SP | 7 | x2 | hedgehog lying upside down/rolled + glove ("inverted hog") |
| 22 | H25.SP | 2 | x2 | hedgehog on a yellow base |
| 23 | OB1.SP | 1 | 28x28 x1 | stack of black tyres |
| 24-35 | OB2..OB13 | 0 | | cactus, barrels, bush, stump, grass, poles: obstacles |

Wiki leads (docs/atr.md): 1 tires, 2 hedgehogs, 3 fireballs, 4 devils, 5 bomb, 6 oil, 7 inverted hog, 8 ice. The sprites and the code below agree with that naming for 2..7 and 1. Kind 8 is not a catalogue kind, see section 3.

## 1. Pickup (existing claim atr.kind-effects, re-read, confirmed)

Routine obj1+0x12bf4 (ends obj1+0x137a4), per drawn object. Kind via obj1+0x13227. Cite: WW.EXE:obj1+0x1324d fp=a3cdbe6e (kinds >=2), obj1+0x1325a, obj1+0x1329c, obj1+0x132a8, obj1+0x132b6, obj1+0x132d6 (kind 1).

* Kind 2 (hedgehog ammo): taken when car+0x6a < 0x63 whether or not an item is held; +4, capped at 0x63. Sound = word 0x28b96 (the driver's own sound, 0..7, see section 7).
* Kinds 3..7: taken only when car+0x16 == 0 and car+0x6a < 0x63 (note: also refused when the ammo counter is full, a side effect of the shared gate at obj1+0x1324d). car+0x16 = kind. Same sound.
* Kind 1 (tyres, OB1): needs 0x28c8c == 0 and 0x28bdc == 0. Plays sound 0x16, marks the .SPW record consumed, sets 0x28c8c = 0xffff and stores three words at obj2+0x20ae8 (y, y+11, y+22 of the object's screen row). Nothing else in the code reads 0x28c8c except a pure drawing/animation state machine: obj1+0x1f7aa (states 1,2,3 -> 0; the three words slide to y 0x72/0x80/0x8e, then to 0xc7/0xc7/0xb1) and obj1+0x15283 (draws three 28x11 strips of the image at obj2+0x1c52c at x = object x+5 and those y). I found NO gameplay effect (no speed, grip or counter change) for kind 1; it looks like a purely visual "tyres fly to the screen" effect plus sound 0x16. Negative finding: grep of `0x28c8c]` over /private/tmp/obj1.dis (12 hits: 19658,19669,21470,21472,32178-32255,32669), 2026-10-03; could be read through another addressing form I did not grep. Confidence medium. (Cite obj1+0x1f7aa fp=453b9d87, obj1+0x132d6 fp=0ba4fd8c.)
* The check only runs for the player's own car (0x1d5b0 is switched per human player; 0x28bdc != 0 disables kind 1). AI cars have no car+0x16/+0x6a pickup path: negative finding, the routine only touches [0x1d5b0], 2026-10-03.

State words (car record = pointer at obj2+0x1d5b0; records at 0x8410 + idx*0x104, idx 0/1 humans):
* car+0x16 held item (0 none, 3..8)
* car+0x6a hedgehog counter (0..0x63); initial value: no writer other than pickup/fire found (so 0 from a memset, inferred)
* car+0xe0 byte: driver ability bits (0x01 boost, 0x02 hop, 0x08 ice shot, 0x10 fire spread; 0x04 tested, result unused). Who sets it: NOT FOUND (no direct writer in obj1; probably a block copy of a per-driver record). Open.
* car+0x80 / +0x8e: fire-button latch and press timestamp (section 3).
* car+0x14 / +0x8a: inverted-controls flag and its start tick.
* car+0x20 = 1 with +0x1a counting down 7..0: spin-out (hit by a projectile); +0x7e crash flag; +0xa airborne.

## 2. Player input and the fire routine

Input: obj1+0x9940.. region (menu/in-race key poll) sets 0x28b40/42/44/46 = bits 0x04/0x08/0x10/0x20 of the key byte 0x28cef (cite WW.EXE:obj1+0x1d6d0 fp=46bf6b4a for the later clearing). So 0x28b42 (button 2, Ctrl by default per brief) is the FIRE flag. Obj1+0x1d6d0 also handles the ability bits: flag 0x01 + buttons 0x28b44 and 0x28b42 together: car+0xb4=1, throttle car+0x42=0xa0, sound 0xc (boost); flag 0x02 + 0x28b44 + 0x28b40: hop (car+0xa=1, sound 0xc) (obj1+0x1d82b, obj1+0x1d8aa). Inferred names.

Fire routine obj1+0x14364 (WW.EXE:obj1+0x14364 fp=4f1061d8), called from the race frame for human 1 (obj1+0x225ad..0x225de) and human 2 (0x22718) only. Negative finding: the only callers of 0x14364 and of the spawner 0x1d548 (grep `call 0x14364`, `call 0x1d548` over obj1.dis, 2026-10-03) are the human-player frame code and the fire routine itself, so AI racers never fire and never pick up.

1. Latch (obj1+0x14398): button released: car+0x8e = now (0x1ec64), car+0x80 = 0. Pressed: first frame sets car+0x80 = 1, car+0x8e = now and goes on to fire; later frames while held clear 0x28b42 (so one shot per press).
2. Hold (obj1+0x14400, fp=ffc947d2): while held, when now - car+0x8e >= 0x14 (20 ticks of the 0x1ec64 counter): car+0x16 = 8 (ice) unless already 8 or dword 0x1e574 != 0; plays the driver sound 0x28b96. Surprising, taken literally: HOLDING FIRE FOR 20 TICKS GIVES THE ICE ITEM (kind 8) for free. I cannot say what 0x1e574 is (set to 1 at obj1+0x2449e when a call with arg 0x1ec0 returns 0, else 0: some config/registration gate? unknown). Confidence: code read in full; intent unknown.
3. Fire gate (obj1+0x1446e): 0x28b42 set, car+0xa == 0 (not airborne), racer record (0xaa90 + idx*0x68)+0x12 [0xaaa2] == 0 (no own shot still in flight), and (car+0x16 != 0 or car+0x6a != 0). Otherwise (obj1+0x14809) plays sound 0x1a (empty click, inferred) if not already playing.
4. Selector (obj1+0x144c0): dx = car+0x16. If 0 (use the counter): dx = 0, but car+0xe0 & 0x10 -> 3, and car+0xe0 & 0x08 -> 8. Jump table at obj1+0x14340 (indices 0..8: 0x1452c, 0x147c4, 0x147c4, 0x14578, 0x14609, 0x14693, 0x146e1, 0x1472f, 0x1477a; 1 and 2 do nothing).
5. After the shot (obj1+0x147c4): sound esi (below), skipped if that sound is already playing; then if car+0x16 == 0 -> car+0x6a -= 1 (hedgehog ammo used) else car+0x16 = 0 (item consumed). So a driver with a special-shot bit spends hedgehog ammo to fire fireballs/ice.

Shots (spawner obj1+0x1d548(type=eax, owner=edx), heading source globals 0x1eb04/0x1eb9c, sprite pointer 0x1eb04):

| selector | cases | spawned | sound | sprite pointer (HOGMIS.SP block) | in-flight flag |
|---|---|---|---|---|---|
| 0 hedgehog (ammo, no ability bit) | obj1+0x1452c | 1 x type 0, offset 0 | 0x14 | obj2+0x1d740 (3 frames, +0x10 anim=3) | 0x28bc0=3; racer+0x12 = 1 |
| 3 fireballs (kind 3 item, or ability 0x10) | obj1+0x14578 | 3 x type 0, offsets 0,1,2 (heading, -0x1e, +0x1e: a 3-way fan) | 0x13 | obj2+0x1d73c, anim 1 | racer+0x12 = 3 |
| 4 devils (kind 4) | obj1+0x14609 | 2 x type 1, headings own +0x1e0 and -0x1e0 (90 degrees left and right of 0x780 per circle) | 0x17 | obj2+0x1d738 | in-flight stays 0 (count set to 0) |
| 5 bomb (kind 5) | obj1+0x14693 | 1 x type 2, heading +0x3c0 (BACKWARD) | 0x17 | 0x1d734 | 0 |
| 6 oil (kind 6) | obj1+0x146e1 | 1 x type 3, backward | 0x17 | 0x1d730 | 0 |
| 7 inverted hog (kind 7) | obj1+0x1472f | 1 x type 4, backward | 0x17 | 0x1d72c | 0 |
| 8 ice (hold-fire item or ability 0x08) | obj1+0x1477a | 1 x type 5, forward, offset 0 | 0x14 | 0x1d728 (4-frame block, anim 3) | 0x28bc0=3; flag 0 |

(In-flight flag: for selectors 0 and 3 the code stores racer+0x12 = 1 or 3 right after spawning; cases 4..8 store 0, so the fire gate only blocks while a hedgehog/fireball volley is flying. Inferred from the stores at obj1+0x1456a, 0x145fb, 0x14570-ish and 0x147bb; the decrement is at obj1+0x161a4 when a shot ends.)

Cites: WW.EXE:obj1+0x1452c fp=c14d1b99, obj1+0x14578 fp=935bfea5, obj1+0x14609 fp=9a5fdfbb, obj1+0x14693 fp=e6a678dd, obj1+0x146e1, obj1+0x1472f (same bytes as 0x14693), obj1+0x1477a fp=25ea96ae, obj1+0x147c4 fp=6a412a8a, obj1+0x147eb fp=c000cc19, obj1+0x14809 fp=94076345, obj1+0x14524 fp=d6e45de6.

Sprites: HOGMIS.SP (0x17c4 = 6084 bytes) is loaded into the buffer at dword 0x1d748 (obj1+0x3b30 fp=f6e9f0fc; filename at obj2+0x2f4). The per-type pointers are carved at obj1+0x3d60 fp=d28eb752: block0 = 0x1d748 (explosion, 0x2be = 3 frames of 0xea=234 bytes), then 0x1d740 (+0x2be, hedgehog, 3 frames), 0x1d73c (+0x2be, fireball, 3 frames), 0x1d738, 0x1d734, 0x1d730, 0x1d72c, 0x1d724 (+0xea each, 1 frame: devil, bomb, oil, inverted hog, and one unused), 0x1d720, 0x1d71c, 0x1d728 (+0x3a8 each, 4 frames; 0x1d728 = ice). 234 = 13x18 or 18x13 (not verified). Total 702+702+702+5*234+3*936 = 6084 checks. (Which pointer is "fireball" vs "hedgehog" is inferred from which case uses it.)

## 3. Projectile life cycle

Table 0x1f2b0, 0x3d (61?) entries, loop `cmp si,0x3c`, 0x22 bytes each (spawn loop obj1+0x1d556: bx up to 0x3c, so 61 slots). Fields (spawner obj1+0x1d548 fp=c1041794):
+0 owner racer idx, +2 type 0..5 (6 is handled in the spawner but no caller creates it), +4 active, +6 state (0xff = exploding), +8 "armed/leaving owner" flag (starts 1), +0xa/+0xc world x/y, +0xe frame index, +0x10 frame count/animation period (from 0x28bc0), +0x12 frame bytes (0xea), +0x14 range limit 0x3e8, +0x16 step (spawn: 0x10 for type 1 and 6, else 0xa), +0x18 distance travelled, +0x1a sprite ptr, +0x1e heading/lane word (copied from 0x1eb9c).
Initial position: one muzzle step (the +0x16 amount, 0xa or 0x10) from the shooter along the heading.

Update obj1+0x1602c (fp=7e752557), move obj1+0x15e6c (fp=950cccfe):
* Types 0 and 5 (hedgehog/fireball and ice): heading is the OWNER'S CURRENT HEADING (racer record +0x...: the dword at 0xaae0 + owner*0x68, refreshed every frame), plus 0 / -0x1e / +0x1e for lane word 0/1/2: so these shots keep steering with the shooter. After the first step the step is set to 0x64 and the travelled distance grows by the step each tick; at >= 0x3e8 the shot ends (obj1+0x160b5..0x160d4): 10 ticks at 0x64. Scale of the step not verified (the rotate/lookup routine 0x27bb1 was not read).
* Type 1 (devils): fixed heading (word +0x1e); on hitting a wall or a map object (collision result 1 or 2) the heading gets +0x3c0 (it bounces back) instead of ending (obj1+0x160e2..0x1617b). No range limit: it lives until it hits a racer. Inferred consequence: the owner's fire stays blocked only if the in-flight count is non-zero, which for devils it is not (see above).
* Types 2,3,4 (bomb, oil, inverted hog): fixed heading, moves step +0x16 (0xa) per tick along the reverse heading; no range limit; ends on any collision result (1,2,3). They are "thrown behind" and keep rolling until they hit something; they are not stationary mines in this code.
* Collision test per step: obj1+0x118a4 (fp=49591350) via line walker obj1+0x12230: terrain value 3 (wall) -> result 1; any non-consumed .SPW object within Manhattan distance < 14 of the shot (any kind, tyres and hedgehog pickups included) -> result 2; a racer (table 0xaa90 + i*0x68, positions at +0x16/+0x18) with state +2 != 2 whose car is not airborne (car+0xa == 0) and within Manhattan distance < 0x12 -> hit.
* Owner immunity: while the shot is within the owner (+8 != 0) no self hit; type 0 and 5 can never hit their owner; types 1..4 can hit the owner after they have left (+8 cleared when the shot is not overlapping, obj1+0x119d9).
* End of a shot (obj1+0x16188): sound 0x12, owner in-flight count decremented (floored at 0), state +6 = 0xff, anim 3 frames, sprite = block0 explosion (0x1d748); the entry is freed after 3 update ticks (obj1+0x16048..0x16062).
* Drawing: obj1+0x1632c (fp=42b2418c) projects each shot like a billboard into the same drawn-object list (entry +0x24 = 0xffff, +0x1c = 0 so the pickup pass skips it).

## 4. Effect on a racer that is hit (obj1+0x11956.. in the collision test)

Applied once per hit when the victim's hit state (racer+0x58) is 0 and the victim is not already wrecked (racer+2 != 2). Result 3 is returned (shot consumed) even when nothing was applied.
* Computer racer (index >= 2, or index 1 outside 2-player modes; inferred from the `cx` tests at obj1+0x11a5f..0x11a75): types 0..4 -> racer+0x58 = 1 (hit), racer+0x4c = now, sound 0x11. Type 5 (ice) -> racer+0x58 = 2, +0x4c = now, sound 0x19 (obj1+0x11b43, fp=b478d326). The AI racer is then skipped by its AI step (obj1+0x18ce0 -> obj1+0x189ec, fp=74ff6e22) until now - +0x4c >= 0x21 (33 ticks; state 1) or 0x32 (50 ticks; states 2/3). While frozen, state alternates 2 <-> 3 with sounds 0x19 / 0x18 (inferred "freeze loop" sounds). In a network game (0x1ec74 != 0) the timeout is 4 and ends by wrecking the racer (+2 = 2, sound 0xd) (obj1+0x18aab..).
* Human racer, normal mode: ice (type 5) -> racer+0x58 = 2 etc. as above (sound 0x19); type 4 (inverted hog) -> car+0x14 = 1, car+0x8a = now (obj1+0x11d86, fp=385202dd). Car+0x14 is read in the control routine at obj1+0x1934a (fp=593262c8), which swaps the left/right steering flags 0x28b8c <-> 0x28b98: inverted steering. It is cleared when now - car+0x8a >= 0x12c = 300 ticks (obj1+0x1fbd6 / 0x1fc0d, fp=299004bd / 672f785e) and at obj1+0x1d518. Types 0..3 -> spin-out (obj1+0x11cbe, fp=f8e1a763): sound 0x11, car+0x1a = 7, +0x3c = 0, +0x20 = 1, +0x18 = 1, car+0x32 = now; the spin frame counter then counts 7..0 in the steering routine (obj1+0x12574..0x12660), throttle cleared at its end.
* Mode 0x28be2 != 0 (a mode with racer count 0x28c40 = 1, i.e. only racers 0 and 1; set by the code at obj1+0x1017a; what the mode is I could not establish): a human hit by types 0..2 is wrecked outright (sound 0xd, racer+2 = 2, car+0x7e = 1; obj1+0x11bc0, fp=0caaefa3), and ice has no effect (treated as type 0) when 0x28be2 or 0x1ec74 is set (obj1+0x11a92, fp=b512735b).
* Mode words 0x28bdc (1 or 2) and 0x1ec74 (modem/network, set at obj1+0x10422) are only identified by what they gate: racer count 1 or 7 (obj1+0x1fe96 region), AI step on/off, projectile effects, the kind 0/1 pickup tests.

## 5. Kind 0 obstacles (re-read, consistent with the claim)

obj1+0x1334d: crash at speed >= 0x64 only if car+0x7e, +0xa, +0x44 are 0, 0x28be2, 0x28bdc, 0x1ec74, 0x1edb0 are 0 and the object's zone word +0x20 == 3 (head on); sound 0xd, car+0x7e = 1.

## 6. Counter (car+0x6a)

Hedgehog ammo. +4 per kind-2 sprite (17 hedgehog sprites, 1 or more per track), cap 0x63, -1 per shot while no item is held. Zero counter and no item -> click sound 0x1a. A held item is used first (the counter is not decremented). The ability bits 0x10/0x08 only replace the shot, not the cost. No HUD reading was traced.

## 7. Sounds (numbers only; names not established)

Sound numbers index the 26+ records at obj2+0x1a9c8 (audio.load: slots of AUDIOT.FX; with the PC-speaker mode records 0..7 alias record 20). The play routine obj1+0x1c04 (fp not taken) takes the number in eax; the is-playing check is obj1+0x1bbc. Numbers seen: 0..7 driver sound taken from 0x28b96 (picks up an item, hold-fire grant); 0xc = boost/hop start; 0xd = crash/wreck; 0x11 = hit by a shot (spin / AI hit); 0x12 = shot explodes; 0x13 = fireball volley; 0x14 = hedgehog / ice shot; 0x15 / 0x16 = car-to-car contact (0x16 also the tyre pickup); 0x17 = devils/bomb/oil/inverted hog thrown; 0x18 / 0x19 = ice freeze loop states, 0x19 also when hit by ice; 0x1a = empty click. The archive holds VOC files that probably carry these in a Sound Blaster mode (HOG.VOC, FLAME.VOC, BOOM.VOC, SWIPE.VOC, DROP.VOC, CLANG.VOC, PUF.VOC, BACKFIRE.VOC, NO.VOC, ...), but the sound-number to file mapping was not traced; any name above is a guess.

## 8. Open / not established

* Source of car+0xe0 ability bits (which driver has fire/ice/boost/hop).
* Meaning of 0x1e574 (gates the hold-fire ice grant), 0x28be2, 0x28bdc, 0x1ec74, 0x1edb0.
* Unit of the 0x1ec64 tick counter (affects every duration: 20, 33, 50, 300 ticks).
* Scale of the projectile step (0x27bb1 not read); 13x18 vs 18x13 for the weapon frames.
* Whether kind 1 (tyres) has any effect beyond the animation and sound 0x16.
* That the "armed" flag +8 is cleared exactly as read (obj1+0x119d9..0x11a08 is a tangled branch).
* Not run: nothing here was observed in DOSBox. Candidates for observation: press fire with kind 3 held (3 entries appear in 0x1f2b0 with types 0 and lanes 0,1,2), hold fire 20 ticks (car+0x16 becomes 8), hit an AI racer (racer+0x58 = 1 for ~33 ticks).

> **Checked 2026-10-04** (`item.racer-hit-observed`, PROVEN, records shot-1 to shot-3): a shot of item 3's fan, of the counter (hedgehog) and of item 8 stops 17 units (Manhattan) from the racer it reaches and sets that racer's hit word +0x58 (1, 1 and 2); 1 lasts 33 ticks, 2 lasts 50 ticks and alternates with 3 (`ai.step-helpers`' limits 0x21 and 0x32); fire is ignored before the green light.

> **Checked 2026-10-04** (`item.mine-types-observed`, PROVEN, records mine-5 to mine-7): the items 5, 6 and 7 each drop one stationary record 10 units behind the car and a racer 10 units from it is stunned (hit word 1, 33 ticks) in the same call, so the three are not distinguished by their effect on a nearby racer.
