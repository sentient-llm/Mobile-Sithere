import Foundation

struct AppEnvironment {
    var supabaseURL: URL
    var anonKey: String
    var apiBaseURL: URL

    static let production = AppEnvironment(
        supabaseURL: URL(string: "https://dyowjavinealuqewfrwa.supabase.co")!,
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5b3dqYXZpbmVhbHVxZXdmcndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NzY4NjIsImV4cCI6MjA5MjA1Mjg2Mn0.0VbaGp3bqbLCbnB2g8ASq89n25lIRpM3eh7rtGtVSVk",
        apiBaseURL: URL(string: "https://dyowjavinealuqewfrwa.supabase.co/functions/v1/api-v1")!
    )
}
