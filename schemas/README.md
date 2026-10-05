# Schéma commun v2 — contrat pour les prochaines étapes

Statut : **contrat initial, pas encore produit par les collecteurs ni par l'export actuel**.
L'application continue d'exporter le schéma communautaire 1.0.0. Ce changement ne lance
aucune tâche agentique, n'accède à aucun nouveau fichier utilisateur et ne connecte aucun cluster.

Le fichier [community-v2.schema.json](community-v2.schema.json) définit un JSON Schema
Draft 2020-12. Le schéma 2.0.0 prépare la collecte progressive, en priorité sur Apple Silicon.
Il couvre aussi Windows/Linux, plusieurs CPU/GPU et plusieurs machines.

## Trois dimensions distinctes

1. `machines` : matériel installé, inventaire par nœud.
2. `execution` : runner, placements demandés et observés, distribution et liens.
3. `tests` : protocole, paramètres, mesures, ressources et réussite de la tâche.

Un GPU détecté n'est pas un GPU utilisé. Un choix demandé n'est pas un placement observé.
Un cluster exécutant un seul modèle réparti utilise `distributed-inference`.
Plusieurs ordinateurs exécutant chacun leur propre benchmark utilisent `independent-machines`.
Chaque test identifie ses propres nœuds participants.

## Données matérielles et exécution

| Bloc | Champs prévus |
|---|---|
| Système | OS, version, noyau, architecture, virtualisation, source d'inventaire |
| CPU | Liste des CPU, modèle, constructeur, sockets, cœurs physiques/logiques, performance/efficacité, NUMA, instructions, fréquence |
| RAM | Capacité physique, mémoire disponible, architecture unifiée/séparée, bande passante, capacité swap |
| GPU | Liste, identifiant local, PCI, modèle, constructeur, type, mémoire dédiée/partagée/unifiée, capacité, pool partagé, pilote, backend, unités de calcul |
| Stockage | Liste, modèle, SSD/HDD/réseau, transport, système de fichiers, capacité, espace libre, rôles modèle/offload/swap/artifacts |
| Runner | Nom/version, moteur/version, backend/version, commit, protocole API |
| Modèle | Identifiant, empreinte/algorithme, format, paramètres totaux/actifs, quantification, bits, adaptateurs, modèle de brouillon |
| Placement | Nœud, CPU/GPU/disques, couches ou fragment de tenseur, mémoire déclarée, offload, source |
| Liens | Nœuds et appareils aux extrémités, transport, RDMA, bande passante, latence |
| Paramètres | Température, seed, tokens, contexte, sampling, threads, batch, concurrence, cache KV/prompt, thinking, décodage spéculatif |

Sur Apple Silicon, RAM et mémoire GPU unifiée partagent le même pool : ne pas additionner
deux capacités qui décrivent ce même pool. Une capacité GPU indépendante inconnue reste inconnue.
Pour Exo, chaque Mac reste un nœud individuel ; les placements et liens décrivent une
exécution distribuée sans imposer une architecture maître/worker.
L'exemple Exo est fictif, sans hypothèse sur une API de télémétrie disponible :
[documentation officielle Exo](https://github.com/exo-explore/exo).

## Mesures et provenance

Chaque mesure a une valeur numérique ou `null`, une unité, un statut, une source,
une nature (`measured`, `declared`, `estimated`), une date et un périmètre.
Les identifiants de nœud/appareil et la méthode précisent l'attribution.

- `available` exige une valeur numérique ; tous les autres statuts exigent `null`.
- Une valeur zéro indique une mesure zéro, jamais une absence de données.
- Capacités et tailles en octets ; temps en ms ; fréquences en Hz ; débits en unités explicites.
- Les températures peuvent être négatives ; capacités et durées doivent être non négatives.
- Les horodatages incluent le fuseau ; les échantillons utilisent un temps relatif au test.
- Les mesures par nœud ne supposent pas des horloges parfaitement synchronisées.
- RSS, physical footprint, tas JS, mémoire GPU et taille déclarée du modèle sont distincts.
- Pic/moyenne indiquent source, nombre d'échantillons, intervalle et agrégation.
- Un débit global de cluster n'est pas la somme des débits par nœud.
- Chargement, mapping, swap et offload disque sont distingués ; les lectures seules
  ne prouvent pas une stratégie d'offload.
- Thinking/réponse restent inconnus si le runner ne fournit pas de comptage séparé.

Les métriques du test prévoient tokens d'entrée/sortie/réflexion/réponse, TTFT,
temps total/chargement/prefill/génération, débits moyens/de génération et énergie.
Les ressources prévoient RSS, empreinte physique, compression/swap, CPU/GPU,
mémoire GPU, disque, réseau, température et puissance.

## Benchmarks agentiques

Un test `agentic` ajoute obligatoirement :

- Le harness/orchestrateur et sa version, le nombre d'agents.
- Les outils disponibles, leurs versions et capacités.
- Les budgets d'étapes, d'appels d'outils et de temps.
- Les étapes ordonnées, leurs dépendances, statuts, durées, appels et retries.
- Les artifacts attendus/produits : chemins relatifs, type, taille et empreinte.
- Les vérifications avec évaluateur/version, plus la réussite globale.

Le scénario exemple répond à une question, crée un dossier, écrit un Markdown puis
vérifie le résultat. Le schéma permet aussi de déplacer un fichier. L'exécution
future utilisera un dossier de test isolé ; aucun chemin absolu ni sortie du workspace
n'est autorisé dans ce profil. Le texte « fichier créé » du modèle ne suffit pas :
la réussite doit être vérifiée par le harness.

L'agenticité mesure la combinaison **modèle + harness + outils + budgets**.
Comparer les résultats exige les mêmes versions du protocole et de l'évaluateur.
Le schéma décrit des autorisations ; il ne les applique pas. L'isolation, les liens
symboliques et les contrôles d'accès appartiennent au futur exécuteur.

## Partage et compatibilité

Ce profil exclut prompts/réponses bruts, arguments d'outils, logs, clés, noms de machine,
numéros de série, IP et chemins locaux absolus. Les identifiants sont propres au rapport,
sans identification publique persistante du matériel.
Un validateur structurel ne peut pas détecter un secret copié dans un champ libre :
le futur exporteur doit utiliser une liste de champs autorisés et une prévisualisation.

Les propriétés inconnues sont refusées. Évolution incompatible : nouvelle version majeure.
L'importeur doit router explicitement v1/v2, sans conversion silencieuse. Les anciennes
données absentes restent inconnues ; aucune topologie ou mesure ne doit être inventée.
Les exemples sont tous marqués `synthetic: true` et ne sont pas des résultats réels.

## Validation et tests

```bash
node schemas/test.cjs
node schemas/validate.cjs schemas/examples/*.json
```

Le validateur sans dépendances couvre le sous-ensemble de mots-clés employé ici
et des contraintes de références/topologie/étapes. Un importeur de production devra
également employer un validateur Draft 2020-12 complet et contrôler les unités,
la cohérence des valeurs, les limites de taille et les budgets pendant l'exécution.

Exemples : Apple génération, Apple agentique, cluster Exo Apple et Linux multi-GPU.

## Intégration progressive

1. Contrat, exemples, validation — cette livraison.
2. Inventaire Apple Silicon : CPU exact, RAM unifiée, GPU, provenance.
3. Export v2 et migration explicite de l'historique.
4. Suivi de ressources et contexte d'exécution.
5. Harness agentique minimal avec outils fichiers isolés.
6. Adaptateur Exo et collecte par nœud, puis autres plateformes.

Chaque étape doit passer ses propres tests avant la suivante.
