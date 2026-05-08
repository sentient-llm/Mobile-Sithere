import SwiftUI

struct OwnerTabView: View {
    var body: some View {
        TabView {
            OwnerHomeView()
                .tabItem { Label("Home", systemImage: "house") }
            ScheduleWalkView()
                .tabItem { Label("Schedule", systemImage: "calendar.badge.plus") }
            OwnerLiveWalkView()
                .tabItem { Label("Live", systemImage: "map") }
            ChatListView()
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
            ReportsView()
                .tabItem { Label("Reports", systemImage: "doc.text") }
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}

struct WalkerTabView: View {
    var body: some View {
        TabView {
            WalkerJobsView()
                .tabItem { Label("Jobs", systemImage: "briefcase") }
            WalkerLiveWalkView()
                .tabItem { Label("Walk", systemImage: "figure.walk") }
            ChatListView()
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
            EarningsView()
                .tabItem { Label("Earnings", systemImage: "chart.line.uptrend.xyaxis") }
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}
