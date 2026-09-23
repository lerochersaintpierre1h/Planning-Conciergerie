// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDVvRxbKqlck7-V5uDZcsGqYXx7rEmMt4g",
  authDomain: "rochersaintpierre1h.firebaseapp.com",
  projectId: "rochersaintpierre1h",
  storageBucket: "rochersaintpierre1h.firebasestorage.app",
  messagingSenderId: "12413486620",
  appId: "1:12413486620:web:baede780cf1e204dc681d9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function app() {
  return {
    isAuthenticated: false,
    loginEmail: '',
    loginPassword: '',
    loginError: '',
    currentYear: new Date().getFullYear(),
    calendarMonths: [],
    reservations: [],
    donnees: {},
    
    // Variables pour la fiche client
    showModalClient: false,
    selectedRes: null,

    initData() {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          this.isAuthenticated = true;
          this.loadFirebaseData();
        } else {
          this.isAuthenticated = false;
        }
      });
      this.$nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    },

    login() {
      this.loginError = '';
      firebase.auth().signInWithEmailAndPassword(this.loginEmail, this.loginPassword)
        .catch((error) => { this.loginError = "Email ou mot de passe incorrect."; });
    },

    logout() {
      firebase.auth().signOut();
    },

    changeGlobalYear(delta) {
      this.currentYear += delta;
      this.renderCalendar();
    },

    loadFirebaseData() {
      db.collection("locations").doc("rocher1H").onSnapshot((doc) => {
        if (doc.exists) {
          if (doc.data().donnees) this.donnees = doc.data().donnees;
          this.renderCalendar();
        }
      });

      db.collection("locations").doc("rocher1H").collection("reservations").onSnapshot((snapshot) => {
        const resas = [];
        snapshot.forEach((doc) => resas.push(doc.data()));
        this.reservations = resas;
        this.renderCalendar();
      });
    },

    isPerso(res) {
      if (!res) return false;
      const fullName = (res.nom + ' ' + (res.prenom || '')).toLowerCase().trim();
      const reverseName = ((res.prenom || '') + ' ' + res.nom).toLowerCase().trim();
      return fullName === 'indispo perso' || reverseName === 'indispo perso';
    },

    getReservationStatus(res) {
      if (!res) return 'option';
      if (this.isPerso(res)) return 'confirme';
      if (res.codeTarif === 'booking' || res.origine === 'booking') return 'confirme';
      return ((Number(res.acompte) || 0) > 0 || (Number(res.soldePaye) || 0) > 0) ? 'confirme' : 'option';
    },

    isDateClosed(dateStr) {
      if (!this.donnees.fermetures) return false;
      return this.donnees.fermetures.some(f => f.debut && f.fin && dateStr >= f.debut && dateStr <= f.fin);
    },

    getColorForRes(res, isClosed) {
      if (isClosed) return '#e2e8f0'; 
      if (!res) return 'rgba(52, 211, 153, 0.3)'; 
      if (this.isPerso(res)) return 'rgba(96, 165, 250, 0.4)'; 
      if (this.getReservationStatus(res) === 'option') return 'rgba(251, 191, 36, 0.4)'; 
      return 'rgba(248, 113, 113, 0.4)'; 
    },

    getDayTooltip(day) {
      if (day.isClosed) return 'Fermé';
      if (!day.resMatin && !day.resAprem) return 'Libre';
      
      if (day.resMatin && day.resAprem && day.resMatin.id === day.resAprem.id) {
        const res = day.resMatin;
        const statut = this.isPerso(res) ? 'Perso' : (this.getReservationStatus(res) === 'confirme' ? 'Confirmé' : 'Option');
        return `${statut} : ${res.nom} ${res.prenom || ''}`;
      }
      
      let tMatin = day.resMatin ? `${this.isPerso(day.resMatin) ? 'Perso' : day.resMatin.nom}` : 'Libre';
      let tAprem = day.resAprem ? `${this.isPerso(day.resAprem) ? 'Perso' : day.resAprem.nom}` : 'Libre';
      return `Matin (Départ) : ${tMatin} \nAprem (Arrivée) : ${tAprem}`;
    },


    // Fonction d'ouverture du pop-up
    openClientCard(day) {
      if (day.isClosed) return; // On ne fait rien si c'est fermé
      
      const res = day.resAprem || day.resMatin; // On prend le client présent ce jour-là
      if (res) {
        this.selectedRes = res;
        this.showModalClient = true;
      }
    },

    renderCalendar() {
      const months = [];
      for (let m = 0; m < 12; m++) {
        const date = new Date(this.currentYear, m, 1);
        let firstDayIndex = date.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;
        const daysArr = [];
        for (let d = 1; d <= new Date(this.currentYear, m + 1, 0).getDate(); d++) {
          const currentDayStr = `${this.currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const resMatin = this.reservations.find(r => currentDayStr > r.dateDebut && currentDayStr <= r.dateFin);
          const resAprem = this.reservations.find(r => currentDayStr >= r.dateDebut && currentDayStr < r.dateFin);
          const isClosed = this.isDateClosed(currentDayStr);
          
          daysArr.push({ dayNum: d, dateStr: currentDayStr, resMatin: resMatin || null, resAprem: resAprem || null, isClosed: isClosed });
        }
        months.push({ name: date.toLocaleString('fr-FR', { month: 'long' }), padding: firstDayIndex, days: daysArr });
      }
      this.calendarMonths = months;
    }
  }
}