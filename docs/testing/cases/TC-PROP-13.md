# TC-PROP-13 — „Navighează": linkul Google Maps și codul QR, spre parcelă sau spre adresă

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-14 |

## What this proves

„Navighează", under a property's „Hartă", opens a dialog with directions to the property in Google Maps, by car,
and the same link as a QR code a phone scans (Slice #39.35, Option A). The link needs no key and makes no Google
request: it goes to the parcel's centre when the property has corners, to its address when it has only an
address; it starts from the device's own location („Locația mea") unless an address is typed as the start. With
neither a shape nor an address the button is disabled and says why. A link that is wrong, a QR code that does not
carry the phone's link (with `dir_action=navigate`), or a button that silently does nothing is the defect this
case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: „TC-PROP-13 Livada" with the
  corners 44.370/25.970, 44.370/25.974, 44.372/25.974, 44.372/25.970; „TC-PROP-13 Casa" with the address „Strada
  Școlii 5, Bragadiru, Ilfov, România" and no corners; „TC-PROP-13 Nimic" with neither.

## What Adrian is asked for

Once, on a phone: scan the code on „Livada" and see Google Maps start navigating.

## Steps

| # | A person does | And sees |
|---|---|---|
| 0 | (Slice 40.35) Opens „Livada", „Hartă" | „Navighează" an icon on the map's top row, right after „Arată unghiuri" and before „HARTĂ \| SATELIT"; no row under the map, the tile ending under the map's box; „+ Adaugă punct" in „Puncte de contur"'s title row, at the right |
| 1 | Opens „Livada", „Hartă", presses „Navighează" | „Spre parcelă: centrul ei pe hartă."; „Locația mea" chosen; „Deschide în Google Maps" opens `…/maps/dir/?api=1&destination=44.371000%2C25.972000&travelmode=driving` in a new tab; the QR code carries the same link with `&dir_action=navigate` |
| 2 | Chooses „De la o adresă", types „Piața Unirii, București" | Before typing: „Scrieți adresa de pornire, ca să apară linkul și codul QR."; after: the link carries `origin=Pia%C8%9Ba%20Unirii%2C%20Bucure%C8%99ti` |
| 3 | Opens „Casa", „Navighează" | „Spre adresa: Strada Școlii 5, Bragadiru, Ilfov, România"; the link's destination is that text |
| 4 | Opens „Nimic" | „Navighează" disabled: „Proprietatea nu are nici formă pe hartă, nici adresă: nu are unde duce un traseu." |

## At the end — leaving things as they were found

Delete the three properties (`DELETE /api/properties/<id>`).

## Notes from the runs

**2026-10-14 — `automated` (Slice #39.35).** `e2e/property/navigate.spec.ts`, with the Google map blocked.
