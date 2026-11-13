import UIKit
import AVFoundation

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Recitation is this app's main purpose: play it as media (even with the silent switch on), keep it going
        // in the background (UIBackgroundModes: audio), and as spoken audio, so a car's navigation voice pauses it
        // briefly instead of talking over it.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = MushafViewController()
        window?.makeKeyAndVisible()
        return true
    }
}
