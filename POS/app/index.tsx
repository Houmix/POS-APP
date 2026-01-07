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
import { POS_URL } from "@/config";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function IdentificationScreen() {
  const navigation = useNavigation();
  const [errorMessage, setErrorMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const clearAll = async () => {
      try {
        await AsyncStorage.clear();
        console.log("Tous les éléments de la session ont été supprimés");
      } catch (e) {
        console.error("Erreur lors de la suppression complète :", e);
      }
    };
    clearAll();
  }, []);

  const postEmployeeToken = async () => {
    try {
      const response = await axios.post(`${POS_URL}/user/api/employee/token/`, {
        phone: phone,
        password: password,
      });
      console.log("Token récupéré :", response.data.access);
      return response.data.access;
    } catch (error) {
      setErrorMessage("Utilisateur introuvable");
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!phone || !password) {
      setErrorMessage("Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await postEmployeeToken();
      const response = await axios.get(`${POS_URL}/user/api/getEmployee/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          phone: phone,
          password: password,
        },
      });

      console.log("Données de l'utilisateur :", response.data);

      if (response.status === 200) {
        await AsyncStorage.setItem("token", accessToken);
        await AsyncStorage.setItem("Empoyee_id", response.data.id.toString());
        await AsyncStorage.setItem("Empoyee_phone", response.data.phone);
        await AsyncStorage.setItem("Employee_restaurant_id", "1");
        navigation.navigate("tabs" as never);
      } else {
        setErrorMessage("Utilisateur introuvable");
      }
    } catch (error) {
      console.error("Erreur lors de la connexion :", error);
      setErrorMessage("Erreur lors de la connexion. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.main}>
          {/* Décoration du haut */}
          <View style={styles.topDecoration}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
          </View>

          <View style={styles.content}>
            {/* Logo/Icône */}
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/logo.png')}
                style={{ width: 80, height: 80 }}
                resizeMode="contain"
              />
            </View>

            {/* Titre */}
            <Text style={styles.title}>Bienvenue</Text>
            <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>

            {/* Message d'erreur */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#e74c3c"
                />
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              </View>
            )}

            {/* Formulaire */}
            <View style={styles.formContainer}>
              {/* Champ Téléphone */}
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="phone"
                  size={24}
                  color="#756fbf"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Numéro de téléphone"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!isLoading}
                />
              </View>

              {/* Champ Mot de passe */}
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="lock"
                  size={24}
                  color="#756fbf"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? "eye" : "eye-off"}
                    size={24}
                    color="#756fbf"
                  />
                </TouchableOpacity>
              </View>

              {/* Bouton de connexion */}
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="login"
                      size={24}
                      color="#fff"
                    />
                    <Text style={styles.buttonText}>Connexion</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Texte info */}
            <Text style={styles.infoText}>
              Vous avez des problèmes d'accès ? Contactez l'administrateur.
            </Text>
          </View>

          {/* Décoration du bas */}
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
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    flexGrow: 1,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  topDecoration: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: 200,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255, 153, 0, 0.1)",
    top: -100,
    left: -80,
  },
  circle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 153, 0, 0.05)",
    top: -50,
    right: -60,
  },
  content: {
    width: "100%",
    alignItems: "center",
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  errorContainer: {
    width: "100%",
    backgroundColor: "#ffe5e5",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 25,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
  },
  errorMessage: {
    color: "#c0392b",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 10,
    flex: 1,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 15,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    width: "100%",
    backgroundColor: "#756fbf",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#756fbf",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 10,
  },
  infoText: {
    marginTop: 25,
    fontSize: 13,
    color: "#999",
    textAlign: "center",
  },
  bottomDecoration: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 200,
    overflow: "hidden",
  },
  circle3: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255, 153, 0, 0.08)",
    bottom: -100,
    right: -80,
  },
  circle4: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 153, 0, 0.05)",
    bottom: -50,
    left: -60,
  },
});