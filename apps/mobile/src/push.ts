import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Api } from "@bp/core";

const TOKEN_KEY="bp:push-device-token";
const USER_KEY="bp:push-user-id";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function enablePush(api:Api,userId:string,requestPermission=false):Promise<boolean> {
  if(Platform.OS==="web" || !Device.isDevice){
    if(requestPermission)throw new Error("Push requires a physical phone and an installed development or production build.");
    return false;
  }
  const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ?? Constants.easConfig?.projectId
    ?? Constants.expoConfig?.extra?.eas?.projectId;
  if(!projectId){
    if(requestPermission)throw new Error("Set EXPO_PUBLIC_EAS_PROJECT_ID to enable notifications.");
    return false;
  }
  let permissions=await Notifications.getPermissionsAsync();
  if(!permissions.granted && requestPermission) permissions=await Notifications.requestPermissionsAsync();
  if(!permissions.granted) return false;
  if(Platform.OS==="android")await Notifications.setNotificationChannelAsync("activity",{
    name:"Activity",importance:Notifications.AndroidImportance.DEFAULT
  });
  const result=await Notifications.getExpoPushTokenAsync({projectId});
  const existingToken=await AsyncStorage.getItem(TOKEN_KEY);
  const previousUser=await AsyncStorage.getItem(USER_KEY);
  if(existingToken && previousUser && previousUser!==userId){
    // Previous user has already signed out; the old device mapping will be
    // expired or removed by a server-side cleanup process.
    await AsyncStorage.multiRemove([TOKEN_KEY,USER_KEY]);
  }
  await api.registerPushToken(result.data, Platform.OS==="ios"?"ios":"android");
  await AsyncStorage.multiSet([[TOKEN_KEY,result.data],[USER_KEY,userId]]);
  return true;
}

export async function logOutWithPush(api:Api) {
  try {
    const token=await AsyncStorage.getItem(TOKEN_KEY);
    if(token) await api.removePushToken(token);
  } catch {
    // Never block sign-out when offline; the server must expire stale tokens.
  }
  await AsyncStorage.multiRemove([TOKEN_KEY,USER_KEY]);
  return api.signOut();
}
