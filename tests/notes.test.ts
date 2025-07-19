// tests/notes.test.ts
import { describeCollection } from "./describeCollection"
import { Notes, fixedDate } from "./utils"

describeCollection("Notes Collection", Notes, {
  id: "1",
  title: "Test Note",
  content: "Some content",
  tags: ["demo"],
  createdAt: fixedDate,
  updatedAt: fixedDate
}) 