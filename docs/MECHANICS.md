# Mechanics

## Board grammar

A board is a lattice of **shafts** (pegs). Each shaft can carry up to two gears,
one on the lower layer and one on the upper layer. Two gears on **one shaft turn
together** (a compound gear) unless a clutch sits between the layers.

Tooth counts are `8, 10, 12, 14, 16`. Pitch radius is `teeth / 24` of a lattice
step, so two orthogonally adjacent gears mesh exactly when their tooth counts add
up to 24. A pair that adds to more than 24 is a collision; a pair that adds to
less is a gap with no transmission. Diagonal neighbours never mesh.

## Transmission

Each connection is an exact ratio on a graph of shaft layers:

| Connection | Ratio `B/A` | Direction |
| --- | --- | --- |
| Mesh | `−teethA / teethB` | reversed |
| Open belt | `pulleyA / pulleyB` | preserved |
| Crossed belt | `−pulleyA / pulleyB` | reversed |
| Rigid shaft | `1` | preserved |
| Clutch shaft | `1`, only when engaged | preserved |

The solver propagates from every motor and every brake:

```
omega(B) = omega(A) × ratio(A→B)
```

Every value is a reduced integer fraction, so a network is consistent exactly
when repeated constraints agree. Two different values reaching one shaft is a
**contradiction** and is reported with the shafts involved. A braked shaft that
is driven is a contradiction too. Unpowered components stay still.

A one-way belt transmits only when the driving side turns in its permitted
direction.

## Torque (simplified)

This is a game model, not industrial engineering:

- each mechanism has an abstract `need`;
- a motor has an abstract `torque` capacity;
- for each mechanism in a motor's component, the reflected load is
  `need / |omegaMechanism / omegaMotor|`;
- if the sum of reflected loads exceeds the motor's capacity, the system is
  **overloaded** and the garden does not run.

Ideal-gear torque therefore rises as speed falls, and free torque multiplication
is impossible.

## Objectives

- **direction** — a mechanism must turn clockwise or anti-clockwise;
- **ratio** — its speed relative to the first motor must equal an exact fraction;
- **torque** — delivered torque must reach the mechanism's need;
- **sync** — two mechanisms must turn at the same signed speed.

The garden wakes only when every objective is met and there are no collisions,
contradictions or overloads.

## Player actions

Tap a tray gear, then tap an empty axle to fit it. Tap a fitted gear to take it
off (fixed gears are bolted on and only inspect). Tap a clutch lever to engage or
release it. **RUN** starts the machine; **STOP** returns to editing. Edits always
stop the machine first.
