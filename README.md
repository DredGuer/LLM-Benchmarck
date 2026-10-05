# LLM Benchmarker Local 🚀

> **Version 0.06** - Benchmark de modèles LLM locaux et externes directement depuis le navigateur
>
> **Développé par** [NVNC](https://nvnc.fr) ✨
>
> **Nouveautés** : Support Gemini ✨ | Monitoring RAM Ollama 💾 | Backend optionnel | Fix timeout modèles lourds (>30B) ⏱️ | **Détection GPU intelligente** 🎮 | **Modes Auto/Manuel** ⚙️ | **Config par type de prompt** 📝 | **Fix bug RAM 0MB** 🐛 | **Détection backend améliorée** 🔄

> **✅ Toutes les fonctionnalités validées** - Sélection des prompts, benchmark, export, historique, monitoring RAM

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]
[![Browser: Chrome/Firefox/Safari](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Safari-blue.svg)]

---

## 📖 Sommaire

- [🚀 Premier benchmark avec Ollama](#-premier-benchmark-avec-ollama)
- [⚙️ Options de lancement](#️-options-de-lancement)
- [🎯 Fonctionnalités](#-fonctionnalités)
- [Documentation technique](TECHNICAL_README.md)
- [Backend RAM et GPU](BACKEND_README.md)
- [🔧 Configuration](#-configuration)
- [📊 Comprendre les mesures](#-comprendre-les-mesures)
- [📝 Export des résultats](#-export-des-résultats)
- [💾 Stockage](#-stockage)
- [📜 Licence](#-licence)
- [🤝 Contribuer](#-contribuer)
- [⚠️ Limitations connues](#️-limitations-connues)

---

## 🚀 Premier benchmark avec Ollama

### 1. Préparer Ollama

Installez [Ollama](https://ollama.com), puis assurez-vous que son serveur fonctionne sur `http://localhost:11434`. Si l'application ne l'a pas déjà démarré, lancez `ollama serve` dans un terminal séparé.

Téléchargez un modèle pour votre premier test :

```bash
ollama pull llama3.2:1b
ollama list
```

Le téléchargement du modèle nécessite une connexion internet.

### 2. Télécharger et ouvrir l'application

Prérequis : Git et Python 3, ainsi qu'un navigateur récent.

```bash
git clone https://github.com/DredGuer/LLM-Benchmarck.git
cd LLM-Benchmarck
python3 -m http.server 8000
```

Gardez ce terminal ouvert et accédez à [LLM Benchmarker](http://localhost:8000/llm-benchmarker.html).

Sans Git, téléchargez [l'archive du dépôt](https://github.com/DredGuer/LLM-Benchmarck/archive/refs/heads/main.zip), décompressez-la, puis lancez `python3 -m http.server 8000` depuis le dossier extrait `LLM-Benchmarck-main`.

Conservez tous les fichiers du dépôt. Ouvrez l'application via le serveur HTTP, plutôt qu'en double-cliquant sur le fichier HTML. Le runner doit également autoriser les requêtes depuis cette origine ; un serveur web local ne résout pas à lui seul toutes les erreurs CORS.

### 3. Lancer un premier test

1. Sélectionnez **Ollama**, puis **llama3.2:1b** ; utilisez 🔄 si la liste est vide.
2. Sélectionnez uniquement **Conversation**.
3. Gardez le **mode Manuel**, choisissez **256 tokens max** et **1 répétition** pour un essai court.
4. Cliquez sur **⚡ Lancer le benchmark**.
5. Suivez la réponse dans **Thinking en direct**, puis consultez **📊 Résultats**.
6. Cliquez sur **📄 Exporter .md** pour télécharger le rapport.

Le backend Node.js n'est pas nécessaire pour ce premier benchmark.

## ⚙️ Options de lancement

### Autres runners et fournisseurs

- **LM Studio** : démarrez son serveur local (port 1234 par défaut), chargez un modèle, puis sélectionnez LM Studio.
- **llama.cpp** : démarrez un serveur compatible avec l'API de chat OpenAI (port 8080 par défaut), puis sélectionnez llama.cpp.
- **OpenAI, Mistral, Claude ou Gemini** : utilisez une clé API valide, configurez-la via **🔑 Clés API**, puis choisissez le fournisseur et un modèle disponible pour votre compte. Ces requêtes nécessitent internet et peuvent être facturées par le fournisseur.
- **Personnalisé** : renseignez l'URL du serveur et le nom du modèle.

### Monitoring RAM Ollama (optionnel)

Avec Node.js et npm installés, ouvrez un autre terminal **à la racine du dépôt** :

```bash
npm install
npm start
```

Le backend démarre sur `http://localhost:3001` et l'interface tente de le détecter automatiquement. Gardez aussi le serveur web du premier terminal en fonctionnement.

La RAM suivie par le backend est celle du processus Ollama sélectionné. Elle ne représente ni la mémoire totale de tous les processus Ollama, ni la VRAM. La mémoire JavaScript du navigateur, lorsqu'elle est disponible, mesure autre chose et ne doit pas être interprétée comme la RAM du modèle.

Consultez [la documentation du backend](BACKEND_README.md) pour les ports, les méthodes de mesure, la détection GPU et le dépannage.

### Autres serveurs web

Depuis la racine du dépôt, vous pouvez remplacer le serveur Python par :

```bash
php -S localhost:8000
```

Ouvrez alors la même URL sur le port 8000. Avec MAMP, placez **tout le dépôt** dans le répertoire web configuré et utilisez l'URL correspondant à ce dossier.

---

## 🎯 Fonctionnalités

### Runners locaux supportés

| Runner | Endpoint | Protocole | Monitoring RAM |
|--------|----------|-----------|----------------|
| 🦙 **Ollama** | `http://localhost:11434` | API native Ollama (streaming) | ✅ **Oui** (via backend) |
| 🏠 **LM Studio** | `http://localhost:1234` | OpenAI-compatible | ❌ Non |
| 🦔 **llama.cpp** | `http://localhost:8080` | OpenAI-compatible | ❌ Non |

### APIs externes

| Fournisseur | Endpoint | Nécessite clé API | Monitoring RAM |
|-------------|----------|------------------|----------------|
| 🤖 **OpenAI** | `https://api.openai.com` | ✅ Oui | ❌ Non |
| 🌊 **Mistral AI** | `https://api.mistral.ai` | ✅ Oui | ❌ Non |
| 🔮 **Anthropic Claude** | `https://api.anthropic.com` | ✅ Oui | ❌ Non |
| 💎 **Google Gemini** | `https://generativelanguage.googleapis.com` | ✅ Oui | ❌ Non |
| ⚙️ **Personnalisé** | Configurable | ❌ Non | ❌ Non |

### Types de prompts

- 💬 **Conversation** - Dialogue libre et réponses générales
- 🏛️ **Datation / Factuel** - Questions de culture générale datées
- 🔢 **Mathématiques** - Résolution de problèmes mathématiques
- 💻 **Code** - Génération ou analyse de code
- 🧠 **Logique** - Résolution de problèmes logiques et raisonnement
- 🎨 **Créatif** - Rédaction créative et brainstorming
- ✏️ **Personnalisé** - Votre propre question ou instruction

### Métriques collectées

| Métrique | Description | Disponible |
|----------|-------------|-----------|
| Tokens générés | Nombre total de tokens produits | ✅ Tous |
| Tokens/seconde | Vitesse de génération | ✅ Tous |
| TTFT (Time To First Token) | Temps avant le premier token | ✅ Ollama (streaming) |
| Temps total | Durée complète de la réponse | ✅ Tous |
| Température | Paramètre de créativité utilisé | ✅ Tous |
| **RAM pic** | Consommation mémoire maximale | ✅ Ollama (avec backend) |
| **RAM moyenne** | Consommation mémoire moyenne | ✅ Ollama (avec backend) |

### Fonctionnalités de debugging

- **Streaming en temps réel** : Visualisation de la réponse token par token pour Ollama
- **Logs de débogage** : Suivi détaillé de chaque test avec horodatage
- **Compteur de tokens** : Suivi en direct du nombre de tokens reçus
- **Barre de progression** : Visualisation du % de tokens reçus vs max
- **Arrêt/Interrompre** : Contrôle manuel pendant le benchmark
- **Monitoring RAM** : Surveillance en temps réel de la consommation mémoire

---

## 🔧 Configuration

### Configuration des clés API

1. Cliquez sur le bouton **"🔑 Clés API"** dans la barre d'outils
2. Saisissez vos clés API pour chaque fournisseur (**Gemini** inclus)
3. Sauvegardez

Les clés sont conservées dans le `localStorage` du navigateur. Lors d'un appel à une API externe, la clé nécessaire à l'authentification et le prompt sont transmis au fournisseur sélectionné.

**Nouveau : Clé API Gemini**
- Format : `AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Obtenez-la sur : https://aistudio.google.com/app/apikey

### Runner personnalisé

Pour utiliser un runner personnalisé :

1. Sélectionnez **⚙️ Personnalisé**
2. Entrez l'URL de base de votre API (ex: `http://localhost:8080`)
3. Entrez le nom du modèle
4. Lancez le benchmark

### Options avancées

| Option | Description | Valeur par défaut |
|--------|-------------|------------------|
| Température | Paramètre d'échantillonnage (0 réduit l'aléatoire sans garantir la reproductibilité) | 0.7 |
| Tokens max | Nombre maximum de tokens à générer | **4096** |
| Répétitions | Nombre de fois à exécuter chaque test | 1 |

## 📊 Comprendre les mesures

- **Tokens et tokens/seconde** : décrivent la génération, pas la qualité de la réponse.
- **TTFT** : disponible avec le streaming Ollama ; inclut le délai observé avant le premier token.
- **Temps total** : durée observée de la requête, influencée par le chargement du modèle et les communications.
- **RAM pic et moyenne** : statistiques des échantillons de mémoire du processus surveillé pendant le test, avec le backend Ollama. La RAM du navigateur est une mesure distincte.
- **Environnement** : les informations du navigateur peuvent être approximatives ; le backend complète la détection matérielle.

Pour comparer des tests, gardez les mêmes prompts et paramètres, et indiquez le matériel ainsi que le runner utilisé.

[Architecture de l'application](TECHNICAL_README.md) · [Détails RAM et GPU](BACKEND_README.md)

---

## 📝 Export des résultats

### Format du rapport Markdown

Le rapport généré contient :

1. **En-tête** : Date, version de l'outil
2. **Environnement** : Configuration matérielle et logicielle
3. **Résumé** : Tableau récapitulatif de tous les tests (**avec colonnes RAM pic et RAM moyenne**)
4. **Détails** : Pour chaque test, métriques, prompt utilisé et réponse complète

Exemple de structure :

```markdown
# 📊 Rapport de Benchmark LLM

> Généré le 15 janvier 2025 à 14:30 par **LLM Benchmarker v0.06**

---

## 💻 Environnement de test

| Paramètre | Valeur |
|-----------|--------|
| Système d'exploitation | macOS |
| Navigateur | Chrome |
| Cœurs CPU | 8 vCPU |
| RAM (approx.) | 16 GB |

## 📈 Résumé des tests

| # | Modèle | Runner | Type | Tokens | Tok/s | TTFT | Temps total | RAM pic | RAM moy | Statut |
|---|--------|--------|------|--------|-------|------|-------------|---------|---------|--------|
| 1 | qwen3.6:27b | Ollama | 💬 Conversation | 1542 | 45.2 | 234ms | 8.50s | 2456 MB | 1892 MB | ✅ OK |
| 2 | gemini-1.5-pro | Gemini | 🏛️ Factuel | 89 | 12.4 | N/A | 7.20s | N/A | N/A | ✅ OK |

## 🔍 Détail des tests

### Test 1 — 💬 Conversation
**Modèle :** `qwen3.6:27b` | **Runner :** Ollama | **Date :** 15/01/2025, 14:30:00

#### Métriques
| Métrique | Valeur |
|----------|--------|
| Tokens générés | 1542 |
| Tokens / seconde | 45.2 |
| Temps 1er token (TTFT) | 234 ms |
| Temps total | 8.50 s |
| Température | 0.7 |
| Tokens max | 2000 |
| RAM pic | 2456 MB | ✨ NOUVEAU
| RAM moyenne | 1892 MB | ✨ NOUVEAU

#### Prompt
Bonjour ! Présente-toi brièvement...

#### Réponse
Je suis un modèle de langage...

---

*Rapport généré automatiquement par LLM Benchmarker v0.06*
```

---

## 💾 Stockage

### localStorage

Toutes les données sont stockées localement dans le navigateur :

- **Résultats actuels** : Stockés dans la variable `state.results` (session)
- **Historique** : Stocké dans `localStorage` sous la clé `llm_bench_history` (jusqu'à 50 sessions)
- **Clés API** : Stockées dans `localStorage` sous la clé `llm_bench_keys`
- **Configuration RAM** : Backend non stocké (exécuté localement)

### Confidentialité

- **Runner local sur votre machine** : les prompts sont envoyés au serveur local sélectionné. Après installation et téléchargement du modèle, les tests locaux peuvent fonctionner sans internet.
- **API externe ou serveur distant personnalisé** : les prompts et les informations nécessaires à l'authentification sont envoyés à ce serveur. Leur traitement dépend du fournisseur.
- **Résultats et historique** : conservés dans le navigateur ; un export crée un fichier sur votre machine.
- **Clés API** : conservées dans `localStorage`, sans chiffrement applicatif. Utilisez un profil de navigateur de confiance.
- **Backend RAM** : fournit à l'interface des informations sur les processus et le matériel de la machine qui l'exécute.

---

## 📜 Licence

**Apache License 2.0**

Ce projet est distribué sous la licence [Apache License, Version 2.0](LICENSE).

© 2025 [NVNC](https://nvnc.fr)

Voir le fichier [LICENSE](LICENSE) pour le texte complet de la licence.

---

### Résumé de la licence Apache 2.0

✅ **Autorisé** :
- Utilisation commerciale
- Modification
- Distribution
- Utilisation dans des projets fermés

❌ **Interdit** :
- Utilisation des marques commerciales sans autorisation
- Retirer les mentions de copyright

⚖️ **Obligations** :
- Inclure une copie de la licence
- Conserver les notices de copyright
- Indiquer les modifications apportées

---

## 🤝 Contribuer

Les contributions sont les bienvenues !

### Comment contribuer

1. **Forker** le dépôt
2. **Créer une branche** (`git checkout -b feature/amazing-feature`)
3. **Commiter** vos changements (`git commit -m 'feat: add amazing feature'`)
4. **Pousser** vers la branche (`git push origin feature/amazing-feature`)
5. **Ouvrir une Pull Request**

### Conventions de code

- **Commits** : Utilisez des messages clairs (`feat:`, `fix:`, `refactor:`, `docs:`)
- **Architecture** : Respectez la séparation en modules (core, ui, utils, config)
- **Noms de fichiers** : Utilisez le kebab-case (`my-module.js`)
- **Commentaires** : Documentez les fonctions et sections complexes

### Suggestions d'améliorations

- [ ] Support de plus de runners locaux (VLLM, Kobold, etc.)
- [ ] Benchmark comparatif entre plusieurs modèles
- [ ] Graphiques de visualisation des résultats (Chart.js, etc.)
- [ ] Export en JSON/CSV
- [ ] Tests automatisés (Jest, Cypress)
- [ ] Interface en anglais
- [ ] Thème sombre/clair
- [ ] Migration vers ES6 modules
- [ ] Intégration avec Prometheus/Grafana pour le monitoring

### 📖 Documentation technique
Pour les améliorations futures et la roadmap détaillée, consultez :
- **[innovation.md](innovation.md)** - Roadmap des fonctionnalités multi-GPU et cluster

---

## ⚠️ Limitations connues

### Version v0.06

- **CORS** : Nécessite un serveur web local pour fonctionner (pas de `file://`)
- **Streaming** : Seule Ollama supporte le streaming pour la mesure du TTFT
- **Modèles lourds** : Peut être lent avec des modèles > 30B paramètres
- **APIs externes** : Nécessite une clé API valide
- **Browser support** : Testé sur Chrome, Firefox, Safari (Edge partiel)
- **Monitoring RAM** : Uniquement disponible pour Ollama avec le backend Node.js
- **Détection GPU** : La détection multi-GPU (NVIDIA/AMD/Intel) nécessite le backend Node.js

### Problèmes connus

| Problème | Solution |
|----------|----------|
| Liste des modèles vide | Vérifiez que le runner est lancé et accessible |
| Erreur CORS | Servez le fichier via un serveur web local |
| Timeout sur modèles >30B (ex: gemma4:31b) | **Fixé en v0.06** - Timeout augmenté à 3 min pour Ollama |
| Clé API invalide | Vérifiez votre clé dans les paramètres |
| RAM affichée comme N/A | **Fixé en v0.06** - Bug corrigé : `peakMemory = 0` bloquait l'affichage |
| Backend non détecté (faux négatif) | **Fixé en v0.06** - Détection améliorée avec `/api/ping` + timeout augmenté à 5s |
| Backend non détecté | Vérifiez que le backend tourne sur `localhost:3001` |

### Dépannage du monitoring RAM

**Backend non détecté** :
```bash
# Vérifiez que le backend est lancé
curl http://localhost:3001/

# Vérifiez qu'Ollama est lancé
ps aux | grep ollama
# ou
ollama list
```

**performance.memory non disponible** :
- Utilisez Chrome avec le flag `--enable-precision-memory-info`
- Ou lancez le backend Node.js pour un monitoring précis

---

## 📞 Support

Pour toute question ou problème :

1. Vérifiez la section [Limitations connues](#️-limitations-connues)
2. Consultez les logs du navigateur (F12 → Console)
3. Assurez-vous que votre runner local est bien lancé
4. Pour le monitoring RAM, vérifiez que le backend est en cours d'exécution

---

## 🏆 Remerciements

- [Ollama](https://ollama.com) - Pour les modèles locaux
- [LM Studio](https://lmstudio.ai) - Pour l'interface utilisateur
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Pour l'inference efficace
- [OpenAI](https://openai.com) - Pour les APIs de référence
- [Mistral AI](https://mistral.ai) - Pour les modèles ouverts
- [Anthropic](https://anthropic.com) - Pour Claude
- [Google](https://ai.google.com) - Pour **Gemini** ✨

---

<div align="center">
  <p>
    <strong>LLM Benchmarker v0.06</strong> - Développé avec ❤️ par [NVNC](https://nvnc.fr) pour la communauté LLM
  </p>
</div>
