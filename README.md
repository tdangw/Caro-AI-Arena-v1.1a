# Caro AI Arena - Hướng dẫn Tùy chỉnh & Cài đặt Online

Chào mừng bạn đến với Caro AI Arena! Tài liệu này sẽ hướng dẫn bạn cách tùy chỉnh tài sản và **thiết lập chế độ chơi online** bằng Firebase.

## Phần 1: Tùy chỉnh Tài sản (Avatar, Âm thanh)

### 1. Cấu trúc Thư mục Tài sản

Tất cả các tài sản công cộng (hình ảnh, âm thanh) nên được đặt trong thư mục `public`. Nếu thư mục này chưa tồn tại ở gốc dự án của bạn, hãy tạo nó. Bên trong `public`, hãy tạo các thư mục con sau:

```
/public
|-- /assets
|   |-- /avatars
|   |   |-- avatar_1.png
|   |   |-- bot_1.png
|   |   |-- ...
|   |-- /sounds
|   |   |-- music.mp3
|   |   |-- move.mp3
|   |   |-- ...
|   |-- /themes
|   |   |-- ice.png
|   |   |-- ...
```

### 2. Thêm Avatar Tùy chỉnh

**Bước 1:** Chuẩn bị hình ảnh (PNG, 128x128 pixels).

**Bước 2:** Sao chép tệp vào thư mục `/public/assets/avatars/`.

**Bước 3:** Đăng ký Avatar trong tệp `constants.tsx` trong mảng `AVATARS`, chỉ định `id`, `name`, và `url` (đường dẫn từ thư mục `public`).

**Ví dụ:**

```typescript
// Trong file: constants.tsx
export const AVATARS: Avatar[] = [
  // ...
  {
    id: 'avatar_my_cool_one',
    name: 'Cool Avatar',
    url: 'assets/avatars/my_cool_avatar.png',
  },
];
```

### 3. Thêm Âm thanh và Nhạc nền

**Hiệu ứng Âm thanh:**
Sao chép các tệp âm thanh (`.mp3`, `.wav`) vào `/public/assets/sounds/`. Tên tệp phải khớp chính xác với danh sách trong `hooks/useSound.ts` (ví dụ: `move.mp3`, `win.mp3`).

**Nhạc nền:**
Sao chép tệp nhạc vào `/public/assets/sounds/` và đăng ký trong `constants.tsx` trong mảng `MUSIC_TRACKS`.

---

## Phần 2: Cài đặt Chế độ Chơi Online (Bắt buộc)

Chế độ online yêu cầu một dự án Firebase. Hãy làm theo các bước sau một cách cẩn thận.

### Bước 1: Tạo Dự án Firebase

1.  Truy cập [Firebase Console](https://console.firebase.google.com/).
2.  Nhấp vào "Add project" (Thêm dự án) và làm theo hướng dẫn để tạo một dự án mới. Đặt tên bất kỳ bạn muốn.

### Bước 2: Tạo một Ứng dụng Web

1.  Trong trang tổng quan dự án của bạn, nhấp vào biểu tượng Web `</>`.
2.  Đặt tên cho ứng dụng của bạn (ví dụ: "Caro Arena Web").
3.  Nhấp vào "Register app" (Đăng ký ứng dụng).
4.  Bạn sẽ thấy một đối tượng cấu hình `firebaseConfig`. **SAO CHÉP TOÀN BỘ ĐỐI TƯỢỢNG NÀY.** Bạn sẽ cần nó ở Bước 6.

### Bước 3: Kích hoạt Authentication

1.  Trong menu bên trái, đi tới "Authentication".
2.  Nhấp vào "Get started" (Bắt đầu).
3.  Trong tab "Sign-in method" (Phương thức đăng nhập), kích hoạt hai nhà cung cấp sau:
    - **Email/Password** (Email/Mật khẩu)
    - **Anonymous** (Ẩn danh)

### Bước 4: Thiết lập Cơ sở dữ liệu (Firestore & Realtime Database)

Bạn sẽ cần cả hai cơ sở dữ liệu cho hệ thống online.

**A. Firestore Database:**

1.  Trong menu bên trái, đi tới "Firestore Database".
2.  Nhấp vào "Create database" (Tạo cơ sở dữ liệu).
3.  Chọn **Start in production mode** (Bắt đầu ở chế độ sản xuất).
4.  Chọn một vị trí máy chủ (thường là khu vực gần bạn nhất).
5.  Nhấp "Enable" (Kích hoạt).
6.  Sau khi tạo xong, đi tới tab **Rules** (Quy tắc) và dán toàn bộ nội dung sau, sau đó nhấp **Publish**:

    ```
    rules_version = '2';

    service cloud.firestore {
      match /databases/{database}/documents {

        // --- Helper Functions ---
        function isAuthenticated() {
          return request.auth != null;
        }

        function isOwner(userId) {
          return isAuthenticated() && request.auth.uid == userId;
        }

        function isPlayerInGame(gameId) {
          let gameDoc = get(/databases/$(database)/documents/games/$(gameId));
          return isAuthenticated() && 'players' in gameDoc.data &&
                 (request.auth.uid == gameDoc.data.players.X || request.auth.uid == gameDoc.data.players.O);
        }

        // --- Collection Rules ---

        // User profiles and subcollections
        match /users/{userId} {
          allow read: if true;
          allow write: if isOwner(userId); // Let owner do anything

          // FIX: Allow gifting by letting authenticated users add to the 'pendingGiftIds' array on another user's profile.
          // This is secure as it only allows additions to this specific field.
          // The rule now correctly handles the case where the `pendingGiftIds` array doesn't exist yet.
          allow update: if isAuthenticated() &&
                           !isOwner(userId) &&
                           request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pendingGiftIds']) &&
                           (
                             !('pendingGiftIds' in resource.data) ||
                             request.resource.data.pendingGiftIds.size() > resource.data.pendingGiftIds.size()
                           );

          match /matchHistory/{gameId} {
            allow read, write: if isOwner(userId);
          }
          
          match /pveMatchHistory/{gameId} {
            allow read, write: if isOwner(userId);
          }

          match /purchaseHistory/{purchaseId} {
            allow read, write: if isOwner(userId);
          }

          match /giftHistory/{giftId} {
            allow read, write: if isOwner(userId);
          }

          match /friends/{friendId} {
            allow read: if isOwner(userId);

            // Allow creating friend requests (batched write for both users)
            allow create: if
              // I am creating a 'pending' request to someone else (friendId)
              (request.auth.uid == userId && request.resource.data.status == 'pending') ||
              // I am being sent a request, so a 'received' doc is created for me by the sender (friendId)
              (request.auth.uid == friendId && request.resource.data.status == 'received');

            // Allow accepting a friend request (batched write for both users)
            allow update: if
              // I am accepting a 'received' request
              (request.auth.uid == userId && resource.data.status == 'received' && request.resource.data.status == 'friends') ||
              // The other user is accepting my 'pending' request
              (request.auth.uid == friendId && resource.data.status == 'pending' && request.resource.data.status == 'friends');

            // Allow deleting/declining a friend (batched write for both users)
            allow delete: if
              // I am deleting a friend from my list
              request.auth.uid == userId ||
              // The other user is deleting me from their list
              request.auth.uid == friendId;
          }

          match /locker/{giftId} {
            allow read, update: if isOwner(userId); // Read and claim own gifts
            allow create: if isAuthenticated() && !isOwner(userId); // Any auth'd user can gift
          }

          match /notifications/{notificationId} {
            allow read, update, delete: if isOwner(userId);
            allow create: if isAuthenticated(); // Anyone can send a notification
          }
        }

        // Real-time online user presence
        match /onlineUsers/{userId} {
          allow read: if isAuthenticated();
          allow create, delete: if isOwner(userId);
          allow update: if isAuthenticated() && (
            isOwner(userId) ||
            // Another user can update your status to 'in_game' for matchmaking
            (request.resource.data.status == 'in_game' && (resource.data.status == 'idle' || resource.data.status == 'in_queue'))
          );
        }

        // Matchmaking queue
        match /matchmakingQueue/{userId} {
          allow read: if isAuthenticated();
          allow create: if isOwner(userId);
          allow delete: if isAuthenticated(); // Anyone can remove someone from the queue (to start a game)
        }

        // Invitations
        match /invitations/{inviteeId} {
          allow read, delete: if isOwner(inviteeId);
          allow create: if isAuthenticated() && request.auth.uid == request.resource.data.from;
        }

        // Game documents
        match /games/{gameId} {
          allow read, update: if isPlayerInGame(gameId);
          allow create: if isAuthenticated() && (request.auth.uid == request.resource.data.players.X || request.auth.uid == request.resource.data.players.O);
          allow delete: if false; // Only allow deletion via a Cloud Function for cleanup, not from client.
        }

        // Centralized chat collection
        match /chats/{chatId} {
            match /messages/{messageId} {
                allow read, create: if isAuthenticated() && (
                    // Case 1: Private chat between two users (ID format: uid1_uid2)
                    (request.auth.uid in chatId.split('_')) ||
                    // Case 2: Game chat (chatId is the gameId)
                    isPlayerInGame(chatId)
                );
                allow update, delete: if false;
            }
        }
      }
    }
    ```

**B. Realtime Database (dành cho Presence System):**

1.  Trong menu bên trái, bên dưới "Firestore Database", nhấp vào **Realtime Database**.
2.  Nhấp vào "Create Database" (Tạo cơ sở dữ liệu).
3.  Chọn một vị trí máy chủ.
4.  Chọn **Start in locked mode** (Bắt đầu ở chế độ khóa).
5.  Nhấp "Enable" (Kích hoạt).
6.  Sau khi tạo xong, đi tới tab **Rules** (Quy tắc) và dán toàn bộ nội dung sau, sau đó nhấp **Publish**:
    ```json
    {
      "rules": {
        "status": {
          ".read": "auth != null",
          "$uid": {
            ".write": "auth != null && auth.uid == $uid"
          }
        }
      }
    }
    ```

### Bước 5: Thêm Gói Firebase vào Dự án

Mở terminal trong thư mục dự án của bạn và chạy lệnh sau:

```bash
npm install firebase
```

### Bước 6: Cấu hình Ứng dụng

1.  Mở tệp `firebaseConfig.ts` trong dự án của bạn.
2.  Bạn sẽ thấy một đối tượng `firebaseConfig` mẫu. **THAY THẾ NÓ** bằng đối tượng bạn đã sao chép ở Bước 2.

**Ví dụ:**

```typescript
// Trong file: firebaseConfig.ts

// Dán cấu hình Firebase của bạn vào đây
const firebaseConfig = {
  apiKey: 'AIzaSyXXXXXXXXXXXXXXXXXXX',
  authDomain: 'your-project-id.firebaseapp.com',
  databaseURL: 'https://your-project-id.firebaseio.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.appspot.com',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abcdef123456',
};
```

### Bước 7: Chạy Ứng dụng

Sau khi hoàn thành tất cả các bước trên, bạn có thể chạy ứng dụng. Chế độ online giờ đây sẽ hoạt động! Mở hai tab trình duyệt để tự kiểm tra các tính năng như mời và chơi game.

---

## Phần 3: Ghi chú cho Môi trường Production

### Dọn dẹp Dữ liệu Tự động

Trong môi trường thực tế, người chơi có thể bỏ ngang trận đấu, để lại các phòng game "mồ côi" trong cơ sở dữ liệu của bạn. Mặc dù ứng dụng có cơ chế dọn dẹp phía client, cách tốt nhất để xử lý việc này là sử dụng **Firebase Cloud Functions**.

Bạn có thể viết một hàm Cloud Function chạy theo lịch (ví dụ, mỗi giờ một lần) để quét và xóa các phòng game cũ chưa được hoàn thành. Điều này giúp giữ cho cơ sở dữ liệu của bạn gọn gàng và hiệu quả.

Chúc bạn tùy chỉnh và thi đấu vui vẻ!