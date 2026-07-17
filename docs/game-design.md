# Void Dynasty — Game Design Doc (MVP)

Working title: **Void Dynasty**. A web-based, illustrated 2D card game about rival spacefaring
Great Houses fighting over the dying husk of a fallen empire. Mechanically inspired by
Pokemon TCG (deck/hand/board structure) and Hearthstone (mana curve, board combat,
animated presentation), reflavored for spaceship-vs-spaceship combat.

This doc is the single source of truth for game rules. The `engine` package must implement
exactly what's described here; anything not covered here is an implementation detail, not a
rules decision.

## 1. Card types

Every card belongs to exactly one **Faction** (House) and one **type**:

| Type | Has board presence? | Notes |
|---|---|---|
| **Captain** | Yes (is the player) | Exactly 1 per deck, chosen at deck select, not shuffled into the draw deck. Represents the player's life total via Captain Hull. |
| **Unit** | Yes (occupies a bay) | Subdivided into `ship` and `creature` for flavor/targeting purposes; mechanically uniform (cost, attack, hull, shields, keywords, abilities). |
| **Module** | No (attaches to a friendly unit) | Weapon/tech upgrade. Buffs stats and/or grants a keyword/ability to the unit it's attached to. Destroyed if the host unit dies. |
| **Order** | No (resolves once, then discarded) | Instant effect: damage, repair, card draw, tempo swing, etc. |

### Captain
- Chosen before the match from the cards available to that House; not part of the 30-card
  deck and cannot be drawn.
- Has **Hull** (default 25) — this is the player's life total. Captain Hull reaching 0 ends
  the game.
- Has a **Passive Trait**: always active, no cost.
- Has a **Command Ability**: costs Reactor Power (RP), usable at most once per turn.

### Unit (Ship / Creature)
- Stats: `cost` (RP to deploy), `attack`, `hull`, `shields` (temporary; absorbs damage before
  hull, does not regenerate on its own), `keywords`, optional triggered `abilities`.
- Occupies one of up to **5 bays** per player on the board.
- Has "deploy sickness": cannot attack the turn it is deployed unless it has the
  **Rapid Deploy** keyword.

### Module
- Played by targeting a friendly unit already in a bay.
- Grants stat bonuses (attack/hull/shields) and/or keywords/abilities to the host unit for as
  long as the host survives. If the host unit is destroyed, its attached modules are
  discarded with it.

### Order
- Played by paying its RP cost; its effect resolves immediately; then it goes to the discard
  pile. No lasting board presence.

## 2. Resources: Reactor Power (RP)

- Each player has an RP cap that starts at 1 and increases by 1 at the start of each of their
  turns, up to a maximum of 10.
- At the start of a player's turn, their RP refills to their current cap (unused RP does not
  carry over between turns).
- All card costs and Command Abilities are paid in RP.

This intentionally replaces Pokemon's "attach one Energy per turn" with a Hearthstone-style
growing resource — simpler for a digital-only game and avoids "energy screw" swinginess.

## 3. Turn structure

1. **Start phase**: RP cap +1 (max 10), RP refills to cap, draw 1 card (if deck is empty, see
   Fatigue below), all friendly units lose deploy sickness / any "just played" flags clear.
2. **Main phase**: play any number of Unit/Module/Order cards you can afford, in any order;
   use your Captain's Command Ability at most once this turn.
3. **Combat phase**: any friendly unit without deploy sickness may attack once, targeting
   either an enemy unit or the enemy Captain directly. If the enemy has any unit with
   **Bulwark**, attacks must target a Bulwark unit first.
4. **End phase**: if hand size exceeds 10, discard down to 10 (highest-cost-first, or player
   choice in a future non-bot UI).

## 4. Combat resolution

- Unit-vs-unit: both units deal their `attack` value to each other simultaneously. Damage is
  applied to `shields` first, then `hull`. A unit with hull <= 0 is destroyed.
- Unit-vs-Captain: the attacking unit deals its `attack` to the enemy Captain's Hull (shields
  do not apply to Captains in the MVP). The Captain does not deal damage back.
- Destroyed units: send to discard, trigger any `onDeath` abilities, and discard any attached
  modules.

## 5. Win condition

- A player loses when their Captain's Hull reaches 0.
- **Fatigue**: if a player must draw from an empty deck, they instead take escalating damage
  directly to their Captain (1 the first time, 2 the second, +1 each subsequent time this
  game). This is a stall-prevention safety net, not a primary win path.

(A secondary "objective track" win condition was considered — see `docs/lore.md` framing — but
is explicitly out of scope for the MVP to keep the rules set learnable in one sitting.)

## 6. Keywords (MVP set)

| Keyword | Effect |
|---|---|
| **Bulwark** | Enemy attacks must target this unit before any other friendly unit. |
| **Cloak** | Cannot be attacked or targeted until it attacks, or until the start of its controller's next turn (whichever first). |
| **Rapid Deploy** | No deploy sickness — may attack the turn it's played. |
| **Boarding** | (Creatures only) If this unit destroys an enemy unit in combat, deal 1 damage directly to the enemy Captain. |
| **Overload** | This card's ability has an added effect, but deals 1 damage to its own Captain when played (risk/reward drawback used by House Voss). |

## 7. Deck construction (MVP)

- Deck size: **30 cards**, max **2 copies** of any non-Captain card.
- Exactly **1 Captain**, chosen separately, not counted in the 30.
- MVP ships with **2 prebuilt starter decks** (House Kessler, House Voss); free deckbuilding
  is out of scope for the MVP (see plan Milestone 2+).

## 8. Bot AI (MVP)

Rule-based, not ML. Priority order per decision point:
1. If a lethal attack sequence exists (sum of legal attacks >= enemy Captain Hull, respecting
   Bulwark), take it.
2. Otherwise, prefer combat trades that destroy an enemy unit without losing a unit of equal
   or greater value.
3. Spend remaining RP on the highest-value affordable play (deploy units/modules/orders),
   roughly biased toward using as much RP as possible each turn ("curving out").
4. Use the Command Ability when it is affordable and either lethal-enabling or clearly
   value-positive (e.g., a heal when Captain Hull is low, a damage ability when it trades
   favorably).
5. Attack with any remaining non-sick units into the enemy Captain if no good trade exists.

## 9. Out of scope for MVP (tracked separately)

- Real multiplayer (server, matchmaking, reconnect).
- Accounts, persistence, collection management, deckbuilding UI.
- Ranked play, spectating, monetization.
- The alternate "objective track" win condition.
