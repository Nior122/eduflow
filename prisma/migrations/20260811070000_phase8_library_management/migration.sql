-- CreateEnum
CREATE TYPE "LibraryItemType" AS ENUM ('BOOK', 'E_BOOK', 'MAGAZINE', 'PAST_QUESTION', 'DIGITAL_RESOURCE');

CREATE TYPE "LibraryCopyCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST');

CREATE TYPE "LibraryCopyStatus" AS ENUM ('AVAILABLE', 'BORROWED', 'RESERVED', 'MAINTENANCE', 'LOST');

CREATE TYPE "LibraryBorrowStatus" AS ENUM ('BORROWED', 'RETURNED', 'OVERDUE', 'LOST');

CREATE TYPE "LibraryReservationStatus" AS ENUM ('PENDING', 'READY', 'CANCELLED', 'FULFILLED', 'EXPIRED');

CREATE TYPE "LibraryFineStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- CreateTable
CREATE TABLE "LibraryAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "actorId" TEXT,

    CONSTRAINT "LibraryAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryAuthor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "LibraryAuthor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "isbn" TEXT,
    "type" "LibraryItemType" NOT NULL DEFAULT 'BOOK',
    "language" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "fileUrl" TEXT,
    "pages" INTEGER,
    "shelfLocation" TEXT,
    "barcode" TEXT,
    "qrData" TEXT,
    "publicationYear" INTEGER,
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "categoryId" TEXT,
    "authorId" TEXT,
    "publisherId" TEXT,

    CONSTRAINT "LibraryBook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryBorrow" (
    "id" TEXT NOT NULL,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "status" "LibraryBorrowStatus" NOT NULL DEFAULT 'BORROWED',
    "note" TEXT,
    "returnedCondition" "LibraryCopyCondition",
    "lateFeeAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "LibraryBorrow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "LibraryCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryCopy" (
    "id" TEXT NOT NULL,
    "copyNumber" INTEGER NOT NULL,
    "barcode" TEXT,
    "condition" "LibraryCopyCondition" NOT NULL DEFAULT 'GOOD',
    "status" "LibraryCopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "acquiredAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "LibraryCopy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryFine" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "status" "LibraryFineStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "borrowId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "LibraryFine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryPublisher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "LibraryPublisher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryReadingHistory" (
    "id" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "LibraryReadingHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryReservation" (
    "id" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "LibraryReservationStatus" NOT NULL DEFAULT 'PENDING',
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "LibraryReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibrarySettings" (
    "id" TEXT NOT NULL,
    "lateFeePerDay" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "maxBorrowDays" INTEGER NOT NULL DEFAULT 14,
    "maxActiveBorrows" INTEGER NOT NULL DEFAULT 5,
    "borrowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "LibrarySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryAuditLog_schoolId_entity_entityId_idx" ON "LibraryAuditLog"("schoolId", "entity", "entityId");
CREATE INDEX "LibraryAuditLog_schoolId_action_idx" ON "LibraryAuditLog"("schoolId", "action");
CREATE INDEX "LibraryAuditLog_createdAt_idx" ON "LibraryAuditLog"("createdAt");
CREATE INDEX "LibraryAuditLog_actorId_idx" ON "LibraryAuditLog"("actorId");
CREATE INDEX "LibraryAuthor_schoolId_isActive_idx" ON "LibraryAuthor"("schoolId", "isActive");
CREATE INDEX "LibraryBook_schoolId_idx" ON "LibraryBook"("schoolId");
CREATE INDEX "LibraryBook_schoolId_isActive_idx" ON "LibraryBook"("schoolId", "isActive");
CREATE INDEX "LibraryBook_schoolId_type_idx" ON "LibraryBook"("schoolId", "type");
CREATE INDEX "LibraryBook_categoryId_idx" ON "LibraryBook"("categoryId");
CREATE INDEX "LibraryBook_authorId_idx" ON "LibraryBook"("authorId");
CREATE INDEX "LibraryBook_publisherId_idx" ON "LibraryBook"("publisherId");
CREATE INDEX "LibraryBook_isbn_idx" ON "LibraryBook"("isbn");
CREATE INDEX "LibraryBorrow_schoolId_status_idx" ON "LibraryBorrow"("schoolId", "status");
CREATE INDEX "LibraryBorrow_studentId_status_idx" ON "LibraryBorrow"("studentId", "status");
CREATE INDEX "LibraryBorrow_copyId_status_idx" ON "LibraryBorrow"("copyId", "status");
CREATE INDEX "LibraryBorrow_bookId_idx" ON "LibraryBorrow"("bookId");
CREATE INDEX "LibraryBorrow_dueDate_idx" ON "LibraryBorrow"("dueDate");
CREATE INDEX "LibraryCategory_schoolId_isActive_idx" ON "LibraryCategory"("schoolId", "isActive");
CREATE INDEX "LibraryCopy_schoolId_status_idx" ON "LibraryCopy"("schoolId", "status");
CREATE INDEX "LibraryCopy_schoolId_isActive_idx" ON "LibraryCopy"("schoolId", "isActive");
CREATE INDEX "LibraryCopy_bookId_idx" ON "LibraryCopy"("bookId");
CREATE INDEX "LibraryCopy_barcode_idx" ON "LibraryCopy"("barcode");
CREATE INDEX "LibraryFine_schoolId_status_idx" ON "LibraryFine"("schoolId", "status");
CREATE INDEX "LibraryFine_studentId_status_idx" ON "LibraryFine"("studentId", "status");
CREATE INDEX "LibraryFine_status_idx" ON "LibraryFine"("status");
CREATE INDEX "LibraryPublisher_schoolId_isActive_idx" ON "LibraryPublisher"("schoolId", "isActive");
CREATE INDEX "LibraryReadingHistory_schoolId_idx" ON "LibraryReadingHistory"("schoolId");
CREATE INDEX "LibraryReadingHistory_studentId_idx" ON "LibraryReadingHistory"("studentId");
CREATE INDEX "LibraryReadingHistory_bookId_idx" ON "LibraryReadingHistory"("bookId");
CREATE INDEX "LibraryReservation_schoolId_status_idx" ON "LibraryReservation"("schoolId", "status");
CREATE INDEX "LibraryReservation_bookId_status_idx" ON "LibraryReservation"("bookId", "status");
CREATE INDEX "LibraryReservation_studentId_status_idx" ON "LibraryReservation"("studentId", "status");
CREATE INDEX "LibraryReservation_expiresAt_idx" ON "LibraryReservation"("expiresAt");

-- CreateIndex (uniques)
CREATE UNIQUE INDEX "LibraryAuthor_schoolId_name_key" ON "LibraryAuthor"("schoolId", "name");
CREATE UNIQUE INDEX "LibraryCategory_schoolId_name_key" ON "LibraryCategory"("schoolId", "name");
CREATE UNIQUE INDEX "LibraryCopy_bookId_copyNumber_key" ON "LibraryCopy"("bookId", "copyNumber");
CREATE UNIQUE INDEX "LibraryFine_borrowId_key" ON "LibraryFine"("borrowId");
CREATE UNIQUE INDEX "LibraryPublisher_schoolId_name_key" ON "LibraryPublisher"("schoolId", "name");
CREATE UNIQUE INDEX "LibrarySettings_schoolId_key" ON "LibrarySettings"("schoolId");

-- AddForeignKey
ALTER TABLE "LibraryAuditLog" ADD CONSTRAINT "LibraryAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryAuditLog" ADD CONSTRAINT "LibraryAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryAuthor" ADD CONSTRAINT "LibraryAuthor_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LibraryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "LibraryAuthor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "LibraryPublisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryBorrow" ADD CONSTRAINT "LibraryBorrow_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryBorrow" ADD CONSTRAINT "LibraryBorrow_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryBorrow" ADD CONSTRAINT "LibraryBorrow_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryBorrow" ADD CONSTRAINT "LibraryBorrow_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryCategory" ADD CONSTRAINT "LibraryCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryFine" ADD CONSTRAINT "LibraryFine_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryFine" ADD CONSTRAINT "LibraryFine_borrowId_fkey" FOREIGN KEY ("borrowId") REFERENCES "LibraryBorrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryFine" ADD CONSTRAINT "LibraryFine_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryPublisher" ADD CONSTRAINT "LibraryPublisher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryReadingHistory" ADD CONSTRAINT "LibraryReadingHistory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryReadingHistory" ADD CONSTRAINT "LibraryReadingHistory_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryReadingHistory" ADD CONSTRAINT "LibraryReadingHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibrarySettings" ADD CONSTRAINT "LibrarySettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
