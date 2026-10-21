# Chlora · visualizzatore 3D

Pagina statica che mostra in 3D i tre modelli STL di Chlora (three.js, senza build e senza dipendenze esterne: librerie e font sono già nella cartella `vendor/` e `fonts/`).

## Avvio

La pagina va aperta tramite un server http (aprendo `index.html` direttamente come file i modelli non si caricano):

```bash
python -m http.server 8000
```

poi apri <http://localhost:8000>.

## Comandi

- **Trascina** per ruotare, **rotella** o **pizzico** per lo zoom, **tasto destro** o **due dita** per spostarti.
- Il modello gira lentamente da solo; si ferma quando lo tocchi e riparte dopo qualche secondo. Il primo pulsante la attiva o la ferma.
- Pulsanti **+ / −** per lo zoom e **Ricentra la vista**.
- Da tastiera (con la scena selezionata): **frecce** per spostarti, **+ / −** per lo zoom, **R** per ricentrare.
- **Modello**: *Tutti*, *Corpo*, *Base* o *Tappo*. In *Tutti* i modelli sono mostrati nelle posizioni dei file, senza montaggio (il tappo nel file è lontano dagli altri due pezzi).
- **Superficie**: piena, wireframe o entrambe; colore e opacità del filo.

## File

- `modello/corpo-chlora.stl` · corpo cilindrico con la scritta «Chlora»
- `modello/base.stl` · base piatta
- `modello/tappo.stl` · tappo
