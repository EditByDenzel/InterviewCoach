import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { designPreviewEnabled } from '../dev/designPreview';
import type { ScenarioImage } from './scenarioImportService';

export async function pickScenarioImage(source: 'camera' | 'library'): Promise<ScenarioImage | null> {
  if (designPreviewEnabled) return { base64: 'c3ludGhldGlj', mimeType: 'image/jpeg' };
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera access is unavailable. Allow it in your phone settings, choose a screenshot, or paste the scenario.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.9, allowsEditing: false, allowsMultipleSelection: false };
  // Web uses the OS picker with a capture hint; native opens the camera directly.
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return imageFromResult(result);
}

function imageFromResult(result: ImagePicker.ImagePickerResult): ScenarioImage | null {
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.base64) throw new Error('The image could not be read. Choose another image or paste the scenario.');
  // SDK 51 native picker encodes JPEG. Web preserves the selected file type.
  return { base64: asset.base64, mimeType: Platform.OS === 'web' ? asset.mimeType || 'image/jpeg' : 'image/jpeg', uri: asset.uri };
}

/** Android may recreate the activity while the OS camera/picker is open. */
export async function recoverScenarioImage(): Promise<ScenarioImage | null> {
  if (designPreviewEnabled || Platform.OS !== 'android') return null;
  const results = await ImagePicker.getPendingResultAsync();
  const result = results?.[0];
  if (!result) return null;
  if ('code' in result) throw new Error('The interrupted photo import could not be recovered. Your text draft is safe; choose the photo again.');
  return imageFromResult(result);
}
