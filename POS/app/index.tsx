import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPosUrl, SERVER_URL_KEY, RESTAURANT_ID_KEY, loadRestaurantId, getRestaurantId, saveRestaurantId } from "@/utils/serverConfig";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useKioskTheme } from "@/contexts/KioskThemeContext";

export default function IdentificationScreen() {
  const navigation = useNavigation();
  const theme = useKioskTheme();
  const [errorMessage, setErrorMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Gestion du clavier visuel
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [activeField, setActiveField] = useState<"phone" | "password" | null>(null);

  useEffect(() => {
    // Réinitialise uniquement les clés de session (garde la config serveur)
    const clearSession = async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const sessionKeys = allKeys.filter(
          k => k !== SERVER_URL_KEY && k !== RESTAURANT_ID_KEY
        );
        if (sessionKeys.length > 0) await AsyncStorage.multiRemove(sessionKeys);
      } catch (e) {
        console.error("Erreur réinitialisation session :", e);
      }
    };
    clearSession();
  }, []);

  const handleKeyPress = (val: string) => {
    if (val === "delete") {
      if (activeField === "phone") setPhone(prev => prev.slice(0, -1));
      if (activeField === "password") setPassword(prev => prev.slice(0, -1));
    } else {
      if (!/^\d+$/.test(val)) return; // Uniquement des chiffres

      if (activeField === "phone") {
        if (phone.length < 10) setPhone(prev => prev + val);
      } else if (activeField === "password") {
        if (password.length < 6) setPassword(prev => prev + val);
      }
    }
  };

  // ✅ NOUVELLE FONCTION DE CONNEXION OPTIMISÉE
  const handleLogin = async () => {
    if (!phone || !password) {
      setErrorMessage("Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      // ✅ CORRECTION : Ajout de "/user" dans l'URL pour correspondre à votre configuration originale
      const response = await axios.post(`${getPosUrl()}/user/api/employee/token/`, {
        phone: phone,
        password: password,
      });

      console.log("Réponse serveur:", response.data); // Pour le débogage

      // On gère les deux cas : soit le backend a été mis à jour (nouveau format), soit non (ancien format)
      const data = response.data;
      
      // Cas 1 : Backend mis à jour (recommandé) -> contient 'tokens' et 'user'
      if (data.tokens && data.user) {
         await AsyncStorage.setItem("token", data.tokens.access);
         await AsyncStorage.setItem("refreshToken", data.tokens.refresh);
         await AsyncStorage.setItem("user", JSON.stringify(data.user));
         
         // Sauvegarde legacy
         if (data.user.id) await AsyncStorage.setItem("Empoyee_id", data.user.id.toString());
         if (data.user.phone) await AsyncStorage.setItem("Empoyee_phone", data.user.phone);
         const restaurantId = data.restaurant_id?.toString() ?? '';
         // Sauvegarder dans les deux clés : legacy (tabs) + serverConfig (useBorneSync)
         await AsyncStorage.setItem("Employee_restaurant_id", restaurantId);
         await saveRestaurantId(restaurantId);

         navigation.navigate("tabs" as never);
      } 
      // Cas 2 : Backend NON mis à jour (Ancien format) -> contient juste 'access' et 'refresh'
      else if (data.access) {
         // Si vous tombez ici, c'est que le fichier views.py n'a pas été modifié correctement.
         // On vous connecte quand même, mais le Rôle Manager ne marchera pas.
         console.warn("⚠️ Backend non mis à jour : Le rôle ne sera pas détecté.");
         
         await AsyncStorage.setItem("token", data.access);
         await AsyncStorage.setItem("refreshToken", data.refresh);
         
         // On essaie de récupérer l'user manuellement comme avant (secours)
         try {
             const userResponse = await axios.get(`${getPosUrl()}/user/api/getEmployee/`, {
                headers: { Authorization: `Bearer ${data.access}` },
                params: { phone, password },
              });
             await AsyncStorage.setItem("user", JSON.stringify(userResponse.data));
             // Important : stocker le user pour que _layout.tsx le lise
             navigation.navigate("tabs" as never);
         } catch(e) {
             navigation.navigate("tabs" as never);
         }
      } else {
        setErrorMessage("Format de réponse serveur inconnu");
      }

    } catch (error: any) {
      console.error("Erreur Login:", error);
      if (error.response) {
          if (error.response.status === 401) setErrorMessage("Identifiants incorrects");
          else if (error.response.status === 403) setErrorMessage("Accès refusé");
          else if (error.response.status === 404) setErrorMessage("URL introuvable (Vérifiez POS_URL)");
          else setErrorMessage(`Erreur serveur (${error.response.status})`);
      } else {
        setErrorMessage("Problème de connexion internet");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const KeyButton = ({ value, label, icon, style }: any) => (
    <TouchableOpacity style={[styles.key, style]} onPress={() => handleKeyPress(value)}>
      {icon ? <MaterialCommunityIcons name={icon} size={28} color="#333" /> : <Text style={styles.keyText}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.main}>
          
          <View style={styles.topDecoration}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
          </View>

          <View style={styles.content}>
            <View style={styles.logoContainer}>
              {theme.logoUrl
                ? <Image source={{ uri: theme.logoUrl }} style={{ width: 80, height: 80 }} resizeMode="contain" />
                : <Image source={require('@/assets/logo.png')} style={{ width: 80, height: 80 }} resizeMode="contain" />
              }
            </View>

            <Text style={styles.title}>Bienvenue</Text>
            <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>

            {errorMessage !== "" && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#e74c3c" />
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.formContainer}>
              {/* Champ Téléphone */}
              <TouchableOpacity 
                activeOpacity={1}
                onPress={() => { setActiveField("phone"); setIsKeyboardVisible(true); }}
                style={[styles.inputWrapper, activeField === "phone" && styles.inputActive]}
              >
                <MaterialCommunityIcons name="phone" size={24} color="#756fbf" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Numéro de téléphone"
                  value={phone}
                  showSoftInputOnFocus={false}
                  selectionColor="transparent"
                  editable={false}
                />
              </TouchableOpacity>

              {/* Champ Mot de passe */}
              <TouchableOpacity 
                activeOpacity={1}
                onPress={() => { setActiveField("password"); setIsKeyboardVisible(true); }}
                style={[styles.inputWrapper, activeField === "password" && styles.inputActive]}
              >
                <MaterialCommunityIcons name="lock" size={24} color="#756fbf" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  value={password}
                  secureTextEntry={!showPassword}
                  showSoftInputOnFocus={false}
                  selectionColor="transparent"
                  editable={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <MaterialCommunityIcons name={showPassword ? "eye" : "eye-off"} size={24} color="#756fbf" />
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Clavier Visuel */}
              {isKeyboardVisible && (
                <View style={styles.keyboardContainer}>
                   <View style={styles.keyboardRow}>
                    <KeyButton value="1" label="1" /><KeyButton value="2" label="2" /><KeyButton value="3" label="3" />
                  </View>
                  <View style={styles.keyboardRow}>
                    <KeyButton value="4" label="4" /><KeyButton value="5" label="5" /><KeyButton value="6" label="6" />
                  </View>
                  <View style={styles.keyboardRow}>
                    <KeyButton value="7" label="7" /><KeyButton value="8" label="8" /><KeyButton value="9" label="9" />
                  </View>
                  <View style={styles.keyboardRow}>
                    <TouchableOpacity 
                      style={[styles.key, styles.validKey]} 
                      onPress={() => setIsKeyboardVisible(false)}
                    >
                      <MaterialCommunityIcons name="check-bold" size={28} color="#fff" />
                    </TouchableOpacity>

                    <KeyButton value="0" label="0" />
                    
                    <KeyButton value="delete" icon="backspace-outline" style={styles.deleteKey} />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin} // ✅ Appel de la nouvelle fonction
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="login" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Connexion</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>
              Vous avez des problèmes d'accès ? Contactez l'administrateur.
            </Text>
          </View>

          <View style={styles.bottomDecoration}>
            <View style={styles.circle3} />
            <View style={styles.circle4} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  scrollContent: { flexGrow: 1 },
  main: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  topDecoration: { position: "absolute", top: 0, width: "100%", height: 200, overflow: "hidden" },
  circle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255, 153, 0, 0.1)", top: -100, left: -80 },
  circle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255, 153, 0, 0.05)", top: -50, right: -60 },
  content: { width: "100%", alignItems: "center", zIndex: 10 },
  logoContainer: {
    marginBottom: 30, width: 120, height: 120, borderRadius: 60, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center", shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  title: { fontSize: 42, fontWeight: "900", color: "#333", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 18, color: "#666", marginBottom: 30, textAlign: "center" },
  errorContainer: {
    width: "80%", maxWidth: 400, backgroundColor: "#ffe5e5", borderRadius: 12, paddingVertical: 12, // Ajusté width
    paddingHorizontal: 15, marginBottom: 25, flexDirection: "row", alignItems: "center",
    borderLeftWidth: 4, borderLeftColor: "#e74c3c",
  },
  errorMessage: { color: "#c0392b", fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 },
  formContainer: { width: "100%", maxWidth: 400 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, marginBottom: 16, paddingHorizontal: 15, borderWidth: 2,
    borderColor: "#f0f0f0", shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 3,
  },
  inputActive: { borderColor: "#756fbf" },
  inputIcon: { marginRight: 10 },
  input: { 
    flex: 1, paddingVertical: 16, fontSize: 16, color: "#333",
    // @ts-ignore
    outlineStyle: 'none' 
  },
  eyeIcon: { padding: 10 },
  
  // Clavier
  keyboardContainer: { marginBottom: 20, width: '100%' },
  keyboardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  key: {
    flex: 1, height: 60, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 5, borderRadius: 12, elevation: 3, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2,
  },

  deleteKey: { backgroundColor: '#ffe5e5' }, // Touche supprimer rouge clair
  keyText: { fontSize: 22, fontWeight: '700', color: '#333' },

  button: {
    width: "100%", backgroundColor: "#756fbf", borderRadius: 12, paddingVertical: 16,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    shadowColor: "#756fbf", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700", marginLeft: 10 },
  infoText: { marginTop: 25, fontSize: 13, color: "#999", textAlign: "center" },
  bottomDecoration: { position: "absolute", bottom: 0, width: "100%", height: 200, overflow: "hidden" },
  circle3: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "rgba(255, 153, 0, 0.08)", bottom: -100, right: -80 },
  circle4: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255, 153, 0, 0.05)", bottom: -50, left: -60 },

  splash: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
},
splashEmoji: { fontSize: 64 },
splashText: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 12 },
splashSub: { fontSize: 14, color: '#888', marginTop: 12 },
app: { flex: 1 },
placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
},
placeholderText: { fontSize: 18, color: '#666' },
});
