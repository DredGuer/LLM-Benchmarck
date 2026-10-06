# Historique SQLite — application 0.15.0, backend 1.5.0

Node **≥ 22.13.0** est requis pour `node:sqlite` (sans dépendance native à compiler). SQLite embarqué reste expérimental dans Node 22/24 ; son avertissement de démarrage n’est pas une erreur.

## Lancement et migration

```bash
git pull origin main
npm install
npm start
```

Dans un autre terminal, à la racine :

```bash
python3 -m http.server 8001 --bind 127.0.0.1
```

Ouvrir `http://localhost:8001/llm-benchmarker.html`. Au démarrage, l’application envoie l’ancien historique et les profils du **site courant** au backend local. Migration atomique et reçus idempotents : un élément supprimé ne réapparaît pas au prochain chargement. La copie `localStorage` est conservée, sans nouvelles écritures d’historique/profils. Des conflits ou données invalides sont signalés et ne bloquent pas la lecture d’une base existante. Pour récupérer un ancien historique d’un autre port/navigateur, ouvrir l’application à cette ancienne adresse avec le backend démarré.

La base se crée hors dépôt :

- macOS : `~/Library/Application Support/LLM-Benchmarker/benchmarks.sqlite`.
- Windows : `%LOCALAPPDATA%/LLM-Benchmarker/benchmarks.sqlite`.
- Linux : `$XDG_DATA_HOME/llm-benchmarker/benchmarks.sqlite`, sinon `~/.local/share/llm-benchmarker/benchmarks.sqlite`.

`LLMB_DATA_DIR` permet de choisir un autre dossier. Les fichiers `-wal`/`-shm` appartiennent à SQLite : ne pas copier seulement le `.sqlite` pendant que le backend écrit. Les permissions POSIX du dossier créé et de la base sont 0700/0600. Les ACL Windows dépendent du compte utilisateur. Le backend écoute maintenant uniquement `127.0.0.1`.

## CRUD dans l’interface

Chaque passe terminée est enregistrée avant la suivante, avec un ID de campagne stable. En cas d’échec, une alerte apparaît, la campagne s’arrête et les résultats restent dans la page pour export/reprise de sauvegarde. Une fermeture avant l’enregistrement de la passe en cours ne permet pas de récupérer cette passe.

L’historique permet restauration à l’écran, modification du nom/notes/tags, exclusion persistante des passes des statistiques, placement en corbeille et restauration. La suppression définitive exige une confirmation et un passage préalable en corbeille. Les mesures/provenances originales ne peuvent pas être réécrites ; les passes suivantes peuvent être ajoutées à la campagne. Les profils conservent enregistrer/charger/mettre à jour et supprimer (dans la même corbeille).

Historique, statistiques et assistant utilisent une vue en mémoire de SQLite, rafraîchie au démarrage, après modification et à l’ouverture des onglets. Les filtres graphiques restent temporaires ; les exclusions persistantes se règlent dans l’historique. Le backend est requis pour lire/sauvegarder ; aucun fallback silencieux vers `localStorage`. Réglages d’interface et clés API restent dans le navigateur.

## Sauvegarde et import

Dans Historique : **Sauvegarder la base** télécharge une sauvegarde **JSON locale** `llmb-local-backup`, version 1, avec données complètes, annotations, profils, corbeille et reçus de migration. **Importer une sauvegarde** fusionne atomiquement, ignore les doublons identiques et refuse les conflits/versions inconnues. Cela ne remplace ni n’efface la base existante. Limite de requête/import : 32 MiB ; sauvegardes plus volumineuses nécessitent actuellement une copie des fichiers SQLite backend arrêté.

Cette sauvegarde locale est distincte du rapport communautaire v2 : elle contient notamment prompts, réponses, traces et artefacts. Vérifier avant partage. Les rapports communautaires restent produits par le chemin d’export existant ; **l’import de rapports communautaires dans SQLite n’est pas inclus dans cette étape**. Pas de chiffrement SQLite ni de gestion sécurisée des clés API dans cette mise à jour. Les champs de clés/authentification connus sont exclus, pas les secrets saisis dans un prompt.

## API locale et schéma

Préfixe `/api/database`. Connexion, Host et Origin doivent être locaux ; JSON uniquement, limite 32 MiB, SQL paramétré, extensions SQLite désactivées. Aucun chemin de base/commande SQL accepté du navigateur.

| Méthode | Route | Action |
|---|---|---|
| GET | `/status` | Version locale et chemin de la base |
| GET / POST | `/sessions`, `/profiles` | Liste active / création ou checkpoint |
| GET | `/sessions?trash=1`, `/profiles?trash=1` | Corbeille |
| PATCH | `/sessions/:id`, `/profiles/:id` | Annotations uniquement |
| DELETE | `/sessions/:id`, `/profiles/:id` | Placement en corbeille |
| POST | `/sessions/:id/restore`, `/profiles/:id/restore` | Restauration |
| DELETE | `/sessions/:id?permanent=1`, équivalent profils | Suppression définitive, corps `{ "confirm": "ID" }` |
| POST | `/migrate` | Ancien historique/profils, transaction et reçus |
| GET / POST | `/backup`, `/import` | Sauvegarde JSON / fusion validée |

Schéma SQLite `user_version=1` : table `records` (type/ID, payload JSON original, annotations JSON, dates, corbeille) et table `migrations` (reçus). WAL, `synchronous=FULL`, attente de verrou 5 s. Une base d’une version supérieure est refusée. Pas de limite arbitraire de 50 campagnes ; pas de synchronisation communautaire ni multi-machine.

## Vérification

```bash
node backend/database.test.cjs
node backend/database-http.test.cjs
node backend/database-ui.test.cjs
node schemas/test.cjs
```

Tests SQLite et HTTP réels, frontend simulé ; le rendu et la migration du vrai profil Safari/Chrome doivent être vérifiés sur la machine utilisateur.
