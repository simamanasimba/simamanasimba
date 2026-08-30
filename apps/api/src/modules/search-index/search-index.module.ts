import { Global, Module } from "@nestjs/common";
import { SearchIndexService } from "./search-index.service";

@Global()
@Module({
  providers: [SearchIndexService],
  exports: [SearchIndexService],
})
export class SearchIndexModule {}
